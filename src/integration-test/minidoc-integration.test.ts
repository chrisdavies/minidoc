import playwright from 'playwright';
import path from 'path';
import proc from 'child_process';
import sirv from 'sirv';
import http from 'http';

jasmine.DEFAULT_TIMEOUT_INTERVAL = 30000;

const testPort = 3003;
let browser: import('playwright').Browser;
let page: import('playwright').Page;

function runTestServer(port: number) {
  return new Promise<http.Server>((resolve) => {
    const server = http.createServer(sirv(__dirname));
    server.listen(port, 512, () => resolve(server));
  });
}

async function initBrowser() {
  if (browser) {
    await browser.close();
  }
  browser = await playwright.chromium.launch({
    // To debug, uncomment the headless and slowMo options.
    // headless: false,
    // slowMo: 150,
  });
  const ctx = await browser.newContext();
  page = ctx.pages()[0] || (await ctx.newPage());
  await page.goto(`http://localhost:${testPort}`);
}

function buildTestScript() {
  // Build our minidoc test script which will run in the browser.
  const result = proc.spawnSync(
    `npx esbuild --global-name=minidoc --bundle ${path.join(
      __dirname,
      'integration-client.ts',
    )} --outfile=${path.join(
      __dirname,
      'dist/minidoctest.js',
    )} --sourcemap=inline --define:process.env.NODE_ENV='development'`,
    { shell: true },
  );
  if (result.status) {
    console.log(result.output.toString());
    throw new Error(`esbuild failed (${result.status})`);
  }
}

/**
 * Test helpers
 */
function isActiveToolbarButton(selector: string) {
  return page.waitForSelector(`${selector}.minidoc-toolbar-btn-active`);
}

function loadDoc(newDoc: string) {
  return page.evaluate((doc) => {
    const tests = (window as any).integrationTests;
    const main = document.querySelector('main')!;
    main.innerHTML = '';
    tests.editor?.dispose();
    tests.editor = tests.minidoc(doc);
    main.appendChild(tests.editor.container);
  }, newDoc);
}

function loadDefault() {
  return loadDoc(
    `<h1>Hello</h1><h2>There</h2><p><strong>I'm strong</strong><a href="http://example.com">Foo</a><em>I'm emphasized</em><b>I'm bold</b><i>I'm italic</i></p>`,
  );
}

function serializeDoc() {
  return page
    .evaluate(() => (window as any).integrationTests.editor.serialize())
    .then((s) => s.replace(/&nbsp;/g, ' '));
}

function editorEl(selector: string) {
  return `.minidoc-editor ${selector}`;
}

async function selectRange(
  startSelector: string,
  startOffset: number,
  endSelector?: string,
  endOffset?: number,
) {
  await page.click(editorEl(startSelector));
  return page.evaluate(
    ({ startSelector, startOffset, endSelector, endOffset }) => {
      const sel = document.getSelection();
      const startNode = document.querySelector(startSelector);
      const range = document.createRange();
      range.setStart(startNode!.childNodes[0], startOffset);
      if (endSelector) {
        const endNode = document.querySelector(endSelector);
        range.setEnd(endNode!.childNodes[0], endOffset);
      }
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(range);
      }
    },
    {
      startSelector: editorEl(startSelector),
      startOffset,
      endSelector: (endSelector && editorEl(endSelector)) || '',
      endOffset: endOffset || startOffset,
    },
  );
}

async function selectNodeContent(selector: string) {
  await page.click(editorEl(selector));
  return page.evaluate((cssSelector) => {
    const sel = document.getSelection();
    const node = document.querySelector(cssSelector)!;
    const range = document.createRange();
    range.selectNodeContents(node);
    if (sel) {
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }, editorEl(selector));
}

function findByText(selector: string, text: string) {
  return page
    .evaluateHandle(
      ({ selector, text }) => {
        const els = document.querySelectorAll(selector);
        return Array.from(els).find((el) => el.textContent === text);
      },
      { selector, text },
    )
    .then((x) => x.asElement())
    .then((x) => {
      if (!x) {
        throw new Error(`Could not find ${selector} with ${text}`);
      }
      return x;
    });
}

// function jsonAttr(obj: any) {
//   return JSON.stringify(obj).replace(/\"/g, '&quot;');
// }

// function execClipboardEvent(selector: string, name: string) {
//   return page.evaluate(
//     (selector, name) => {
//       const el = document.querySelector(selector);
//       const e = new CustomEvent(name);
//       const win = window as any;
//       win.puppeteerClipboard = win.puppeteerClipboard || new Map();
//       (e as any).clipboardData = {
//         files: [],
//         getData(k: string) {
//           return win.puppeteerClipboard.get(k);
//         },
//         setData(k: string, v: any) {
//           win.puppeteerClipboard.set(k, v);
//         },
//       };
//       el.dispatchEvent(e);
//     },
//     selector,
//     name,
//   );
// }

// const clipboard = {
//   copy: (selector: string) => execClipboardEvent(selector, 'copy'),
//   cut: (selector: string) => execClipboardEvent(selector, 'cut'),
//   paste: (selector: string) => execClipboardEvent(selector, 'paste'),
// };

async function press(...keys: string[]) {
  for (const k of keys) {
    await page.keyboard.down(k);
  }

  return Promise.all(keys.map((k) => page.keyboard.up(k)));
}

function pressCtrl(key: string) {
  return press('Meta', key);
}

describe('minidoc', () => {
  let server: http.Server;

  beforeAll(buildTestScript);

  beforeAll(async () => {
    server = await runTestServer(testPort);
    await initBrowser();
  }, 60000);

  afterAll(async () => {
    await browser.close();
    await new Promise((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve(undefined))),
    );
  });

  describe('toolbar', () => {
    beforeEach(loadDefault);

    it('highlights the bold button when in a strong or b', async () => {
      await page.click('.minidoc-editor strong');
      expect(await isActiveToolbarButton('[aria-label="Bold"]')).toBeTruthy();
      await page.click('.minidoc-editor b');
      expect(await isActiveToolbarButton('[aria-label="Bold"]')).toBeTruthy();
    });

    it('highlights the i button when in a strong or b', async () => {
      await page.click('.minidoc-editor em');
      expect(await isActiveToolbarButton('[aria-label="Italic"]')).toBeTruthy();
      await page.click('.minidoc-editor i');
      expect(await isActiveToolbarButton('[aria-label="Italic"]')).toBeTruthy();
    });

    it('highlights the link button when in a link', async () => {
      await page.click('[href="http://example.com"]');
      expect(await isActiveToolbarButton('[aria-label="Link"]')).toBeTruthy();
    });

    it('highlights the h1 button when in an h1', async () => {
      await page.click('h1');
      expect(await isActiveToolbarButton('[aria-label="Heading 1"]')).toBeTruthy();
    });

    it('highlights the h2 button when in an h1', async () => {
      await page.click('h2');
      expect(await isActiveToolbarButton('[aria-label="Heading 2"]')).toBeTruthy();
    });

    it('toggles h1', async () => {
      const toolbarDoc = `<h1>Hello</h1><h2>There</h2><p>You</p>`;
      await loadDoc(toolbarDoc);
      await page.click('h1');
      await page.click('[aria-label="Heading 1"]');
      expect(await serializeDoc()).toEqual(`<p>Hello</p><h2>There</h2><p>You</p>`);
      await page.keyboard.type('Focused?');
      expect(await serializeDoc()).toEqual(`<p>Focused?</p><h2>There</h2><p>You</p>`);
      await page.click('[aria-label="Heading 1"]');
      expect(await serializeDoc()).toEqual(`<h1>Focused?</h1><h2>There</h2><p>You</p>`);
    });

    it('toggles h2', async () => {
      const toolbarDoc = `<h1>Hello</h1><h2>There</h2><p>You</p>`;
      await loadDoc(toolbarDoc);
      await page.click('h2');
      await page.click('[aria-label="Heading 2"]');
      expect(await serializeDoc()).toEqual(`<h1>Hello</h1><p>There</p><p>You</p>`);
      await page.keyboard.type('Focused?');
      expect(await serializeDoc()).toEqual(`<h1>Hello</h1><p>Focused?</p><p>You</p>`);
      await page.click('[aria-label="Heading 2"]');
      expect(await serializeDoc()).toEqual(`<h1>Hello</h1><h2>Focused?</h2><p>You</p>`);
    });

    it('new ul', async () => {
      const toolbarDoc = `<h1>Hello</h1><p><br /></p>`;
      await loadDoc(toolbarDoc);
      await page.click('p');
      await page.click('[aria-label="Bullet list"]');
      await page.type('[contenteditable]', 'this is in an li');
      expect(await serializeDoc()).toEqual(`<h1>Hello</h1><ul><li>this is in an li</li></ul>`);
    });

    it('select li and type', async () => {
      const toolbarDoc = `<ul><li>what gives?</li></ul>`;
      await loadDoc(toolbarDoc);
      await selectRange('li', 0, 'li', 11);
      await press('Backspace');
      expect(await serializeDoc()).toEqual(`<ul><li><br></li></ul>`);
      await page.type('[contenteditable]', 'ahem');
      expect(await serializeDoc()).toEqual(`<ul><li>ahem</li></ul>`);
    });

    it('toggles uls', async () => {
      const toolbarDoc = `<h1>Hello</h1><h2>There</h2><ol><li>Fella</li></ol><p>You</p><p>Guys</p>`;
      await loadDoc(toolbarDoc);
      await selectRange('h2', 0, 'p', 1);
      await page.click('[aria-label="Bullet list"]');
      expect(await serializeDoc()).toEqual(
        `<h1>Hello</h1><ul><li>There</li><li>Fella</li><li>You</li></ul><p>Guys</p>`,
      );
      await page.click('[aria-label="Bullet list"]');
      expect(await serializeDoc()).toEqual(
        `<h1>Hello</h1><p>There</p><p>Fella</p><p>You</p><p>Guys</p>`,
      );
      await page.click('[aria-label="Bullet list"]');
      expect(await serializeDoc()).toEqual(
        `<h1>Hello</h1><ul><li>There</li><li>Fella</li><li>You</li></ul><p>Guys</p>`,
      );
    });

    it('toggles ols', async () => {
      const toolbarDoc = `<h1>Hello</h1><h2>There</h2><ul><li>Fella</li></ul><p>You</p><p>Guys</p>`;
      await loadDoc(toolbarDoc);
      await selectRange('h2', 0, 'p', 1);
      await page.click('[aria-label="Ordered list"]');
      expect(await serializeDoc()).toEqual(
        `<h1>Hello</h1><ol><li>There</li><li>Fella</li><li>You</li></ol><p>Guys</p>`,
      );
      await page.click('[aria-label="Ordered list"]');
      expect(await serializeDoc()).toEqual(
        `<h1>Hello</h1><p>There</p><p>Fella</p><p>You</p><p>Guys</p>`,
      );
      await page.click('[aria-label="Ordered list"]');
      expect(await serializeDoc()).toEqual(
        `<h1>Hello</h1><ol><li>There</li><li>Fella</li><li>You</li></ol><p>Guys</p>`,
      );
    });

    it('bold and unbold', async () => {
      await selectNodeContent('strong');
      await page.click('[aria-label="Bold"]');
      expect(await serializeDoc()).toEqual(
        `<h1>Hello</h1><h2>There</h2><p>I'm strong<a href="http://example.com">Foo</a><em>I'm emphasized</em><b>I'm bold</b><i>I'm italic</i></p>`,
      );
      await selectNodeContent('b');
      await page.click('[aria-label="Bold"]');
      expect(await serializeDoc()).toEqual(
        `<h1>Hello</h1><h2>There</h2><p>I'm strong<a href="http://example.com">Foo</a><em>I'm emphasized</em>I'm bold<i>I'm italic</i></p>`,
      );
      await page.click('[aria-label="Bold"]');
      expect(await serializeDoc()).toEqual(
        `<h1>Hello</h1><h2>There</h2><p>I'm strong<a href="http://example.com">Foo</a><em>I'm emphasized</em><strong>I'm bold</strong><i>I'm italic</i></p>`,
      );
    });

    it('italic and unitalic', async () => {
      await selectNodeContent('em');
      await page.click('[aria-label="Italic"]');
      expect(await serializeDoc()).toEqual(
        `<h1>Hello</h1><h2>There</h2><p><strong>I'm strong</strong><a href="http://example.com">Foo</a>I'm emphasized<b>I'm bold</b><i>I'm italic</i></p>`,
      );
      await selectNodeContent('i');
      await page.click('[aria-label="Italic"]');
      expect(await serializeDoc()).toEqual(
        `<h1>Hello</h1><h2>There</h2><p><strong>I'm strong</strong><a href="http://example.com">Foo</a>I'm emphasized<b>I'm bold</b>I'm italic</p>`,
      );
      await page.click('[aria-label="Italic"]');
      expect(await serializeDoc()).toEqual(
        `<h1>Hello</h1><h2>There</h2><p><strong>I'm strong</strong><a href="http://example.com">Foo</a>I'm emphasized<b>I'm bold</b><em>I'm italic</em></p>`,
      );
    });

    it('bold and backspacing', async () => {
      await loadDoc(`<h1>Hello</h1><p>Stuff goes here</p>`);
      await selectRange('p', 6, 'p', 10);
      await pressCtrl('b');
      expect(await serializeDoc()).toEqual(`<h1>Hello</h1><p>Stuff <strong>goes</strong> here</p>`);
      await selectRange('strong', 4, 'strong', 4);
      await press('Backspace');
      await press('Backspace');
      await press('Backspace');
      await press('Backspace');
      expect(await serializeDoc()).toEqual(`<h1>Hello</h1><p>Stuff  here</p>`);
      await page.type('[contenteditable]', 'goes');
      expect(await serializeDoc()).toEqual(`<h1>Hello</h1><p>Stuff <b>goes</b> here</p>`);
      await selectRange('b', 0, 'b', 4);
      await pressCtrl('b');
      expect(await serializeDoc()).toEqual(`<h1>Hello</h1><p>Stuff goes here</p>`);
      await press('Backspace');
      expect(await serializeDoc()).toEqual(`<h1>Hello</h1><p>Stuff  here</p>`);
    });

    it('link and unlink', async () => {
      await selectNodeContent('a');
      await page.click('[aria-label="Link"]');
      await page.waitForSelector('.minidoc-toolbar-txt');
      await page.keyboard.type('/foo/bar');
      const btnLink = await findByText('button', 'Link');
      await btnLink.click();
      await page.waitForSelector('[href="/foo/bar"]');
      expect(await serializeDoc()).toEqual(
        `<h1>Hello</h1><h2>There</h2><p><strong>I'm strong</strong><a href="/foo/bar">Foo</a><em>I'm emphasized</em><b>I'm bold</b><i>I'm italic</i></p>`,
      );
      await page.waitForSelector('[aria-label="Link"]');
      await page.click('[aria-label="Link"]');
      await page.waitForSelector('.minidoc-toolbar-txt');
      const btnUnlink = await findByText('button', 'Unlink');
      await btnUnlink.click();
      await page.waitForFunction(() => !document.querySelector('.minidoc-highlighter'));
      expect(await serializeDoc()).toEqual(
        `<h1>Hello</h1><h2>There</h2><p><strong>I'm strong</strong>Foo<em>I'm emphasized</em><b>I'm bold</b><i>I'm italic</i></p>`,
      );
    });

    it('multiline link and unlink', async () => {
      const toolbarDoc = `<h1>Hello</h1><h2>There</h2><ul><li>Fella</li></ul><p>You</p><p>Guys</p>`;
      await loadDoc(toolbarDoc);
      await selectRange('h2', 0, 'p', 1);
      await page.click('[aria-label="Link"]');
      await page.waitForSelector('.minidoc-toolbar-txt');
      await page.keyboard.type('/xoxo');
      const btnLink = await findByText('button', 'Link');
      await btnLink.click();
      expect(await serializeDoc()).toEqual(
        `<h1>Hello</h1><h2><a href="/xoxo">There</a></h2><ul><li>Fella</li></ul><p>You</p><p>Guys</p>`,
      );
      await page.waitForSelector('[aria-label="Link"]');
      await page.click('[aria-label="Link"]');
      await page.waitForSelector('.minidoc-toolbar-txt');
      const btnUnlink = await findByText('button', 'Unlink');
      await btnUnlink.click();
      await page.waitForFunction(() => !document.querySelector('.minidoc-highlighter'));
      expect(await serializeDoc()).toEqual(
        `<h1>Hello</h1><h2>There</h2><ul><li>Fella</li></ul><p>You</p><p>Guys</p>`,
      );
    });

    //   it('media alignment loads card meta', async () => {
    //     const state = {
    //       name: 'pic.png',
    //       src: '/pic.png',
    //       type: 'image/png',
    //     };
    //     const toolbarDoc = `<h1>Hello</h1><mini-card type="media" meta="${jsonAttr({
    //       align: 'left',
    //     })}" state="${jsonAttr(state)}"></mini-card><p>You</p>`;
    //     await loadDoc(toolbarDoc);
    //     expect(await page.$('.minidoc-card-align-left')).toBeTruthy();
    //   });

    //   it('media alignment', async () => {
    //     const state = {
    //       name: 'pic.png',
    //       src: '/pic.png',
    //       type: 'image/png',
    //     };
    //     const toolbarDoc = `<h1>Hello</h1><mini-card type="media" state="${jsonAttr(
    //       state,
    //     )}"></mini-card><p>You</p>`;
    //     await loadDoc(toolbarDoc);
    //     await page.click('mini-card');
    //     await page.waitForSelector('[aria-label="Align left"]');
    //     await page.click('[aria-label="Align left"]');
    //     expect(await serializeDoc()).toEqual(
    //       `<h1>Hello</h1><mini-card state="{&quot;name&quot;:&quot;pic.png&quot;,&quot;src&quot;:&quot;/pic.png&quot;,&quot;type&quot;:&quot;image/png&quot;}" type="media" meta="{&quot;align&quot;:&quot;left&quot;}"></mini-card><p>You</p>`,
    //     );
    //     await page.click('[aria-label="Align right"]');
    //     expect(await serializeDoc()).toEqual(
    //       `<h1>Hello</h1><mini-card state="{&quot;name&quot;:&quot;pic.png&quot;,&quot;src&quot;:&quot;/pic.png&quot;,&quot;type&quot;:&quot;image/png&quot;}" type="media" meta="{&quot;align&quot;:&quot;right&quot;}"></mini-card><p>You</p>`,
    //     );
    //     await page.click('[aria-label="Full width"]');
    //     expect(await serializeDoc()).toEqual(
    //       `<h1>Hello</h1><mini-card state="{&quot;name&quot;:&quot;pic.png&quot;,&quot;src&quot;:&quot;/pic.png&quot;,&quot;type&quot;:&quot;image/png&quot;}" type="media" meta="{&quot;align&quot;:&quot;full&quot;}"></mini-card><p>You</p>`,
    //     );
    //   });
  });

  describe('selection', () => {
    beforeAll(() => page.reload());

    async function deleteWithKey(key: string) {
      const toolbarDoc = `<h1>Hello</h1><h2>There</h2><p><strong>I'm strong</strong><em>I'm emphasized</em></p><p>New P <b>I'm bold</b><i>I'm italic</i></p>`;
      await loadDoc(toolbarDoc);
      await selectRange('h1', 2, 'strong', 3);
      await press(key);
      expect(await serializeDoc()).toEqual(
        `<h1>He<strong> strong</strong><em>I'm emphasized</em></h1><p>New P <b>I'm bold</b><i>I'm italic</i></p>`,
      );
      await page.keyboard.type('yo');
      expect(await serializeDoc()).toEqual(
        `<h1>Heyo<strong> strong</strong><em>I'm emphasized</em></h1><p>New P <b>I'm bold</b><i>I'm italic</i></p>`,
      );
    }

    it('select and delete', () => deleteWithKey('Delete'));
    it('select and backspace', () => deleteWithKey('Backspace'));

    it('enter in an h1', async () => {
      const toolbarDoc = `<h1>Hello</h1>`;
      await loadDoc(toolbarDoc);
      await selectRange('h1', 5);
      await press('Enter');
      expect(await serializeDoc()).toEqual(`<h1>Hello</h1><p><br></p>`);
      await page.keyboard.type('yo');
      expect(await serializeDoc()).toEqual(`<h1>Hello</h1><p>yo</p>`);
    });

    it('select and type', async () => {
      const toolbarDoc = `<h1>Hello</h1><h2>There</h2><p><strong>I'm strong</strong><em>I'm emphasized</em></p><p>New P <b>I'm bold</b><i>I'm italic</i></p>`;
      await loadDoc(toolbarDoc);
      await selectRange('h1', 2, 'strong', 3);
      await page.keyboard.type('man');
      expect(await serializeDoc()).toEqual(
        `<h1>Heman<strong> strong</strong><em>I'm emphasized</em></h1><p>New P <b>I'm bold</b><i>I'm italic</i></p>`,
      );
      await page.keyboard.type('yo');
      expect(await serializeDoc()).toEqual(
        `<h1>Hemanyo<strong> strong</strong><em>I'm emphasized</em></h1><p>New P <b>I'm bold</b><i>I'm italic</i></p>`,
      );
    });

    it('select and enter', async () => {
      const toolbarDoc = `<h1>Hello</h1><h2>There</h2><p><strong>I'm strong</strong><em>I'm emphasized</em></p><p>New P <b>I'm bold</b><i>I'm italic</i></p>`;
      await loadDoc(toolbarDoc);
      await selectRange('h1', 2, 'strong', 3);
      await press('Enter');
      expect(await serializeDoc()).toEqual(
        `<h1>He</h1><p><strong> strong</strong><em>I'm emphasized</em></p><p>New P <b>I'm bold</b><i>I'm italic</i></p>`,
      );
      await page.keyboard.type('yo');
      expect(await serializeDoc()).toEqual(
        `<h1>He</h1><p><strong>yostrong</strong><em>I'm emphasized</em></p><p>New P <b>I'm bold</b><i>I'm italic</i></p>`,
      );
    });

    it('select and enter in an h1', async () => {
      const toolbarDoc = `<h1>Hello there</h1>`;
      await loadDoc(toolbarDoc);
      await selectRange('h1', 5, 'h1', 6);
      await press('Enter');
      expect(await serializeDoc()).toEqual(`<h1>Hello</h1><h1>there</h1>`);
      await page.keyboard.type('yo');
      expect(await serializeDoc()).toEqual(`<h1>Hello</h1><h1>yothere</h1>`);
    });

    it('backspace at start of element', async () => {
      const toolbarDoc = `<h1>Hello</h1><h2>There</h2>`;
      await loadDoc(toolbarDoc);
      await selectRange('h2', 0, 'h2', 0);
      await press('Backspace');
      expect(await serializeDoc()).toEqual(`<h1>Hello</h1><p>There</p>`);
      await press('Backspace');
      expect(await serializeDoc()).toEqual(`<h1>HelloThere</h1>`);
      await page.keyboard.type('yo');
      expect(await serializeDoc()).toEqual(`<h1>HelloyoThere</h1>`);
    });

    it('delete at start of element', async () => {
      const toolbarDoc = `<h1>Hello</h1>`;
      await loadDoc(toolbarDoc);
      await selectRange('h1', 0, 'h1', 0);
      await press('Delete');
      expect(await serializeDoc()).toEqual(`<h1>ello</h1>`);
      await page.keyboard.type('yo');
      expect(await serializeDoc()).toEqual(`<h1>yoello</h1>`);
    });

    it('delete at end of element', async () => {
      const toolbarDoc = `<h1>Hello</h1><h2>There</h2><p>Stuff</p>`;
      await loadDoc(toolbarDoc);
      await selectRange('h1', 5, 'h1', 5);
      await press('Delete');
      expect(await serializeDoc()).toEqual(`<h1>HelloThere</h1><p>Stuff</p>`);
      await page.keyboard.type('yo');
      expect(await serializeDoc()).toEqual(`<h1>HelloyoThere</h1><p>Stuff</p>`);
    });

    it('backspace at start of element', async () => {
      const toolbarDoc = `<h1>Hello</h1><h2>There</h2><p><strong>I'm strong</strong><em>I'm emphasized</em></p><p>New P <b>I'm bold</b><i>I'm italic</i></p>`;
      await loadDoc(toolbarDoc);
      await selectRange('p', 0, 'p', 0);
      await press('Backspace');
      expect(await serializeDoc()).toEqual(
        `<h1>Hello</h1><h2>There<strong>I'm strong</strong><em>I'm emphasized</em></h2><p>New P <b>I'm bold</b><i>I'm italic</i></p>`,
      );
      await page.keyboard.type('yo');
      expect(await serializeDoc()).toEqual(
        `<h1>Hello</h1><h2>Thereyo<strong>I'm strong</strong><em>I'm emphasized</em></h2><p>New P <b>I'm bold</b><i>I'm italic</i></p>`,
      );
    });

    it('backspace at end of element', async () => {
      const toolbarDoc = `<h1>Hello</h1><h2>There</h2><p><strong>I'm strong</strong><em>I'm emphasized</em></p><p>New P <b>I'm bold</b><i>I'm italic</i></p>`;
      await loadDoc(toolbarDoc);
      await selectRange('h1', 5, 'h1', 5);
      await press('Backspace');
      expect(await serializeDoc()).toEqual(
        `<h1>Hell</h1><h2>There</h2><p><strong>I'm strong</strong><em>I'm emphasized</em></p><p>New P <b>I'm bold</b><i>I'm italic</i></p>`,
      );
      await page.keyboard.type('yo');
      expect(await serializeDoc()).toEqual(
        `<h1>Hellyo</h1><h2>There</h2><p><strong>I'm strong</strong><em>I'm emphasized</em></p><p>New P <b>I'm bold</b><i>I'm italic</i></p>`,
      );
    });

    //   it('inline copy and paste', async () => {
    //     const doc = `<h1>Hoi</h1><p>This is using i and b instead of em and strong. <b>Does</b> it <i>work</i>?. Well, here's an <em>em</em></p>`;
    //     await loadDoc(doc);
    //     await selectRange('p', 0, 'em', 2);
    //     await clipboard.copy('[contenteditable]');
    //     await page.click('h1');
    //     await clipboard.paste('[contenteditable]');
    //     expect(await serializeDoc()).toEqual(
    //       `<h1>HoiThis is using i and b instead of em and strong. <b>Does</b> it <i>work</i>?. Well, here's an <em>em</em></h1><p>This is using i and b instead of em and strong. <b>Does</b> it <i>work</i>?. Well, here's an <em>em</em></p>`,
    //     );
    //   });

    //   it('multiline copy and paste', async () => {
    //     const doc = `<h1>Hoi</h1><p>This <strong>MUST</strong> work.</p><p>But does it?</p><p>Eh?</p>`;
    //     await loadDoc(doc);
    //     await selectRange('p', 0, 'p ~ p', 3);
    //     await clipboard.copy('[contenteditable]');
    //     await selectRange('p:last-child', 0);
    //     await clipboard.paste('[contenteditable]');
    //     expect(await serializeDoc()).toEqual(
    //       `<h1>Hoi</h1><p>This <strong>MUST</strong> work.</p><p>But does it?</p><p>This <strong>MUST</strong> work.</p><p>But</p><p>Eh?</p>`,
    //     );
    //   });
  });

  // describe('cards', () => {
  //   beforeEach(() => page.reload());

  //   it('paste does not write into a card', async () => {
  //     const doc = `<h1>Hello</h1><mini-card type="counter" state="0"></mini-card><h2>There</h2><p><strong>I'm strong</strong><em>I'm emphasized</em></p>`;
  //     await loadDoc(doc);
  //     await page.click('p');
  //     await selectNodeContent('p');
  //     await clipboard.copy('[contenteditable]');
  //     await page.click('mini-card');
  //     await clipboard.paste('[contenteditable]');
  //     expect(await serializeDoc()).toEqual(
  //       `<h1>Hello</h1><p><strong>I'm strong</strong><em>I'm emphasized</em></p><mini-card state="0" type="counter"></mini-card><h2>There</h2><p><strong>I'm strong</strong><em>I'm emphasized</em></p>`,
  //     );
  //   });

  //   it('cards are initialized and disposed in edit mode', async () => {
  //     await page.evaluate(() => {
  //       const el: any = document.querySelector('[data-test-subj="editor-container"]');
  //       el.innerHTML = '';
  //       el.editor.dispose();

  //       const win: any = window;

  //       const testCard = {
  //         type: 'testcard',
  //         render() {
  //           const el = document.createElement('strong');
  //           el.innerHTML = 'Heyo!';
  //           win.integrationTests.onMount(el, () => {
  //             win.editableTestCard = 'initialized';
  //             return () => (win.editableTestCard = 'disposed');
  //           });
  //           return el;
  //         },
  //       };
  //       el.editor = win.integrationTests.editableMinidoc({
  //         el,
  //         doc: `<h1>Hi</h1><mini-card type="testcard"></mini-card><p>There</p>`,
  //         cards: [testCard],
  //         toolbarActions: win.integrationTests.defaultToolbarActions,
  //       });
  //     });

  //     expect(await page.evaluate(() => (window as any).editableTestCard)).toEqual('initialized');
  //     await page.evaluate(() => document.querySelector('mini-card')!.remove());
  //     expect(await page.evaluate(() => (window as any).editableTestCard)).toEqual('disposed');
  //   });

  //   it('cards are copiable', async () => {
  //     const doc = `<h1>Hello</h1><h2>There</h2><mini-card type="counter" state="0"></mini-card><p><strong>I'm strong</strong><em>I'm emphasized</em></p>`;
  //     await loadDoc(doc);
  //     await page.click('mini-card');
  //     await clipboard.copy('[contenteditable]');
  //     await clipboard.paste('[contenteditable]');
  //     expect(await serializeDoc()).toEqual(
  //       `<h1>Hello</h1><h2>There</h2><mini-card state="0" type="counter"></mini-card><mini-card state="0" type="counter"></mini-card><p><strong>I'm strong</strong><em>I'm emphasized</em></p>`,
  //     );
  //   });

  //   it('cards are cuttable', async () => {
  //     const doc = `<h1>Hello</h1><h2>There</h2><mini-card type="counter" state="0"></mini-card><p><strong>I'm strong</strong><em>I'm emphasized</em></p>`;
  //     await loadDoc(doc);
  //     await page.click('mini-card');
  //     await clipboard.cut('[contenteditable]');
  //     expect(await serializeDoc()).toEqual(
  //       `<h1>Hello</h1><h2>There</h2><p><strong>I'm strong</strong><em>I'm emphasized</em></p>`,
  //     );
  //     await clipboard.paste('[contenteditable]');
  //     expect(await serializeDoc()).toEqual(
  //       `<h1>Hello</h1><h2>There</h2><mini-card state="0" type="counter"></mini-card><p><strong>I'm strong</strong><em>I'm emphasized</em></p>`,
  //     );
  //   });

  //   it('pressing enter in a card', async () => {
  //     const doc = `<h1>Hello</h1><mini-card type="counter" state="0"></mini-card><h2>There</h2><p><strong>I'm strong</strong><em>I'm emphasized</em></p>`;
  //     await loadDoc(doc);
  //     await page.click('mini-card');
  //     await press('Enter');
  //     expect(await serializeDoc()).toEqual(
  //       `<h1>Hello</h1><mini-card state="0" type="counter"></mini-card><p><br></p><h2>There</h2><p><strong>I'm strong</strong><em>I'm emphasized</em></p>`,
  //     );
  //     await page.keyboard.type('Hoi!');
  //     expect(await serializeDoc()).toEqual(
  //       `<h1>Hello</h1><mini-card state="0" type="counter"></mini-card><p>Hoi!</p><h2>There</h2><p><strong>I'm strong</strong><em>I'm emphasized</em></p>`,
  //     );
  //   });

  //   it('cards can be backspaced', async () => {
  //     const doc = `<h1>Hello</h1><mini-card type="counter" state="0"></mini-card><h2>There</h2><p><strong>I'm strong</strong><em>I'm emphasized</em></p>`;
  //     await loadDoc(doc);
  //     await page.click('mini-card');
  //     await press('Backspace');
  //     expect(await serializeDoc()).toEqual(
  //       `<h1>Hello</h1><h2>There</h2><p><strong>I'm strong</strong><em>I'm emphasized</em></p>`,
  //     );
  //     await page.keyboard.type('Hoi!');
  //     expect(await serializeDoc()).toEqual(
  //       `<h1>HelloHoi!</h1><h2>There</h2><p><strong>I'm strong</strong><em>I'm emphasized</em></p>`,
  //     );
  //   });

  //   it('cards can be deleted', async () => {
  //     const doc = `<h1>Hello</h1><mini-card type="counter" state="0"></mini-card><h2>There</h2><p><strong>I'm strong</strong><em>I'm emphasized</em></p>`;
  //     await loadDoc(doc);
  //     await page.click('mini-card');
  //     await press('Delete');
  //     expect(await serializeDoc()).toEqual(
  //       `<h1>Hello</h1><h2>There</h2><p><strong>I'm strong</strong><em>I'm emphasized</em></p>`,
  //     );
  //     await page.keyboard.type('Hoi!');
  //     expect(await serializeDoc()).toEqual(
  //       `<h1>Hello</h1><h2>Hoi!There</h2><p><strong>I'm strong</strong><em>I'm emphasized</em></p>`,
  //     );
  //   });

  //   it('deleting into a block', async () => {
  //     const doc = `<h1>Hello</h1><mini-card type="counter" state="0"></mini-card><h2>There</h2><p><strong>I'm strong</strong><em>I'm emphasized</em></p>`;
  //     await loadDoc(doc);
  //     await selectRange('h1', 5, 'h1', 5);
  //     await press('Delete');
  //     expect(await serializeDoc()).toEqual(
  //       `<h1>Hello</h1><mini-card state="0" type="counter"></mini-card><h2>There</h2><p><strong>I'm strong</strong><em>I'm emphasized</em></p>`,
  //     );
  //     await press('Delete');
  //     expect(await serializeDoc()).toEqual(
  //       `<h1>Hello</h1><h2>There</h2><p><strong>I'm strong</strong><em>I'm emphasized</em></p>`,
  //     );
  //   });

  //   it('backspacing into a block', async () => {
  //     const doc = `<h1>Hello</h1><mini-card type="counter" state="0"></mini-card><h2>There</h2><p><strong>I'm strong</strong><em>I'm emphasized</em></p>`;
  //     await loadDoc(doc);
  //     await selectRange('h2', 0, 'h2', 0);
  //     await press('Backspace');
  //     expect(await serializeDoc()).toEqual(
  //       `<h1>Hello</h1><mini-card state="0" type="counter"></mini-card><h2>There</h2><p><strong>I'm strong</strong><em>I'm emphasized</em></p>`,
  //     );
  //     await press('Backspace');
  //     expect(await serializeDoc()).toEqual(
  //       `<h1>Hello</h1><h2>There</h2><p><strong>I'm strong</strong><em>I'm emphasized</em></p>`,
  //     );
  //   });

  //   it('undo / redo is stable', async () => {
  //     const state = {
  //       name: 'pic.png',
  //       src: '/pic.png',
  //       type: 'image/png',
  //     };
  //     const cardHtml = `<mini-card type="media" state="${jsonAttr(state)}"></mini-card>`;
  //     const toolbarDoc = `<h1>Hello</h1>${cardHtml}${cardHtml}<p>You</p>`;
  //     await loadDoc(toolbarDoc);
  //     await page.click('h1');
  //     await page.keyboard.type('Some stuff...');
  //     expect(await serializeDoc()).toEqual(
  //       `<h1>HelloSome stuff...</h1><mini-card state="{&quot;name&quot;:&quot;pic.png&quot;,&quot;src&quot;:&quot;/pic.png&quot;,&quot;type&quot;:&quot;image/png&quot;}" type="media"></mini-card><mini-card state="{&quot;name&quot;:&quot;pic.png&quot;,&quot;src&quot;:&quot;/pic.png&quot;,&quot;type&quot;:&quot;image/png&quot;}" type="media"></mini-card><p>You</p>`,
  //     );
  //     await pressCtrl('z');
  //     expect(await serializeDoc()).toEqual(
  //       `<h1>Hello</h1><mini-card state="{&quot;name&quot;:&quot;pic.png&quot;,&quot;src&quot;:&quot;/pic.png&quot;,&quot;type&quot;:&quot;image/png&quot;}" type="media"></mini-card><mini-card state="{&quot;name&quot;:&quot;pic.png&quot;,&quot;src&quot;:&quot;/pic.png&quot;,&quot;type&quot;:&quot;image/png&quot;}" type="media"></mini-card><p>You</p>`,
  //     );
  //   });
  // });

  // describe('readonly mode', () => {
  //   beforeAll(() => page.reload());

  //   it('is not editable', async () => {
  //     const state = {
  //       name: 'pic.png',
  //       src: '/pic.png',
  //       type: 'image/png',
  //     };
  //     const cardHtml = `<mini-card type="media" state="${jsonAttr(state)}"></mini-card>`;
  //     await loadDoc(`<h1>Hi</h1>${cardHtml}<p>There</p>`, true);
  //     expect(await page.$('[contenteditable]')).toBeFalsy();
  //     expect(
  //       await page.evaluate(
  //         () => document.querySelector('[data-test-subj="editor-container"]')!.innerHTML,
  //       ),
  //     ).toEqual(
  //       `<div class="minidoc-root minidoc-content"><h1>Hi</h1><mini-card type="media" state="{&quot;name&quot;:&quot;pic.png&quot;,&quot;src&quot;:&quot;/pic.png&quot;,&quot;type&quot;:&quot;image/png&quot;}" class="minidoc-card minidoc-card-align-full"><div class="minidoc-card-contents"><figure class="minidoc-media"><img class="minidoc-media-asset" src="/pic.png" alt="pic.png"><figcaption class="minidoc-media-caption"></figcaption></figure></div></mini-card><p>There</p></div>`,
  //     );
  //   });

  //   it('inits and disposes cards', async () => {
  //     await page.evaluate(() => {
  //       const el: any = document.querySelector('[data-test-subj="editor-container"]');
  //       const win: any = window;
  //       el.innerHTML = '';
  //       el.editor.dispose();

  //       const testCard = {
  //         type: 'testcard',
  //         render() {
  //           const el = document.createElement('strong');
  //           el.innerHTML = 'Heyo!';
  //           win.integrationTests.onMount(el, () => {
  //             win.readonlyTestCard = 'initialized';
  //             return () => (win.readonlyTestCard = 'disposed');
  //           });
  //           return el;
  //         },
  //       };
  //       el.editor = win.integrationTests.readonlyMinidoc({
  //         el,
  //         doc: `<h1>Hi</h1><mini-card type="testcard"></mini-card><p>There</p>`,
  //         cards: [testCard],
  //       });
  //     });

  //     expect(await page.evaluate(() => (window as any).readonlyTestCard)).toEqual('initialized');
  //     await page.evaluate(() => document.querySelector('mini-card')!.remove());
  //     expect(await page.evaluate(() => (window as any).readonlyTestCard)).toEqual('disposed');
  //   });
  // });

  describe('lists', () => {
    beforeAll(() => page.reload());

    it('tab / shift tab', async () => {
      await loadDoc(`<h1>Hello</h1><ul><li>A</li><li>B</li><li>C</li></ul><p>Ze end!</p>`);
      await page.click('li ~ li');
      await press('Tab');
      expect(await serializeDoc()).toEqual(
        `<h1>Hello</h1><ul><li>A<ul><li>B</li></ul></li><li>C</li></ul><p>Ze end!</p>`,
      );
      await page.click('li ~ li');
      await press('Tab');
      expect(await serializeDoc()).toEqual(
        `<h1>Hello</h1><ul><li>A<ul><li>B</li><li>C</li></ul></li></ul><p>Ze end!</p>`,
      );
      await press('Shift', 'Tab');
      expect(await serializeDoc()).toEqual(
        `<h1>Hello</h1><ul><li>A<ul><li>B</li></ul></li><li>C</li></ul><p>Ze end!</p>`,
      );
    });

    it('backspace first li', async () => {
      await loadDoc(
        `<h1>Hello</h1><ul><li>A<ul><li>1</li><li>2</li></ul></li><li>B</li><li>C</li></ul><p>Ze end!</p>`,
      );
      await selectRange('li', 0);
      await press('Backspace');
      expect(await serializeDoc()).toEqual(
        `<h1>Hello</h1><p>A</p><ul><li>1</li><li>2</li><li>B</li><li>C</li></ul><p>Ze end!</p>`,
      );
    });

    it('backspace nested li', async () => {
      await loadDoc(`<h1>Hello</h1><ul><li>A</li><li>B</li><li>C</li></ul><p>Ze end!</p>`);
      await selectRange('li ~ li', 0);
      await press('Backspace');
      expect(await serializeDoc()).toEqual(
        `<h1>Hello</h1><ul><li>AB</li><li>C</li></ul><p>Ze end!</p>`,
      );
      await page.keyboard.type(' through ');
      expect(await serializeDoc()).toEqual(
        `<h1>Hello</h1><ul><li>A through B</li><li>C</li></ul><p>Ze end!</p>`,
      );
    });

    it('backspace li selection', async () => {
      await loadDoc(`<h1>Hello</h1><ul><li>abc</li><li>def</li><li>ghi</li></ul><p>Ze end!</p>`);
      await selectRange('li', 1, 'li ~ li', 1);
      await press('Backspace');
      expect(await serializeDoc()).toEqual(
        `<h1>Hello</h1><ul><li>aef</li><li>ghi</li></ul><p>Ze end!</p>`,
      );
      await page.keyboard.type(' through ');
      expect(await serializeDoc()).toEqual(
        `<h1>Hello</h1><ul><li>a through ef</li><li>ghi</li></ul><p>Ze end!</p>`,
      );
    });

    it('delete at end of li', async () => {
      await loadDoc(`<h1>Hello</h1><ul><li>A</li><li>B</li><li>C</li></ul><p>Ze end!</p>`);
      await selectRange('li', 1);
      await press('Delete');
      expect(await serializeDoc()).toEqual(
        `<h1>Hello</h1><ul><li>AB</li><li>C</li></ul><p>Ze end!</p>`,
      );
      await page.keyboard.type(' through ');
      expect(await serializeDoc()).toEqual(
        `<h1>Hello</h1><ul><li>A through B</li><li>C</li></ul><p>Ze end!</p>`,
      );
    });

    it('delete at end of list', async () => {
      await loadDoc(`<h1>Hello</h1><ul><li>A</li><li>B</li><li>C</li></ul><p>Ze end!</p>`);
      await selectRange('li:last-child', 1);
      await press('Delete');
      expect(await serializeDoc()).toEqual(
        `<h1>Hello</h1><ul><li>A</li><li>B</li><li>CZe end!</li></ul>`,
      );
      await page.keyboard.type(' through ');
      expect(await serializeDoc()).toEqual(
        `<h1>Hello</h1><ul><li>A</li><li>B</li><li>C through Ze end!</li></ul>`,
      );
    });

    it('enter at start of last li', async () => {
      await loadDoc(`<h1>Hello</h1><ul><li>A</li><li>B</li><li>C</li></ul><p>Ze end!</p>`);
      await selectRange('li:last-child', 0);
      await press('Enter');
      expect(await serializeDoc()).toEqual(
        `<h1>Hello</h1><ul><li>A</li><li>B</li><li><br></li><li>C</li></ul><p>Ze end!</p>`,
      );
    });

    it('enter at end of last li', async () => {
      await loadDoc(`<h1>Hello</h1><ul><li>A</li><li>B</li><li>C</li></ul><p>Ze end!</p>`);
      await selectRange('li:last-child', 1);
      await press('Enter');
      await press('Enter');
      expect(await serializeDoc()).toEqual(
        `<h1>Hello</h1><ul><li>A</li><li>B</li><li>C</li></ul><p><br></p><p>Ze end!</p>`,
      );
    });

    it('enter within text of last li', async () => {
      await loadDoc(`<h1>Hello</h1><ul><li>A</li><li>B</li><li>Cats</li></ul><p>Ze end!</p>`);
      await selectRange('li:last-child', 1);
      await press('Enter');
      expect(await serializeDoc()).toEqual(
        `<h1>Hello</h1><ul><li>A</li><li>B</li><li>C</li><li>ats</li></ul><p>Ze end!</p>`,
      );
    });

    // it('cut ol lis and paste into p', async () => {
    //   const doc = `<h1>Hoi</h1><p><br></p><p>cough</p><ol><li>abc</li><li>123</li></ol>`;
    //   await loadDoc(doc);
    //   await selectRange('li', 1, 'li ~ li', 2);
    //   await clipboard.cut('[contenteditable]');
    //   await selectRange('p', 0, 'p', 0);
    //   await clipboard.paste('[contenteditable]');
    //   expect(await serializeDoc()).toEqual(
    //     `<h1>Hoi</h1><ol><li>bc</li><li>12</li></ol><p>cough</p><ol><li>a3</li></ol>`,
    //   );
    // });

    //   it('copy list', async () => {
    //     const doc = `<h1>Hoi</h1><p>This</p><ul><li>is</li><li>a</li></ul><p><strong>test</strong> of lis</p>`;
    //     await loadDoc(doc);
    //     await selectRange('p', 0, 'strong', 2);
    //     await clipboard.copy('[contenteditable]');
    //     await selectRange('p', 0);
    //     await clipboard.paste('[contenteditable]');
    //     expect(await serializeDoc()).toEqual(
    //       `<h1>Hoi</h1><p>This</p><ul><li>is</li><li>a</li></ul><p><strong>te</strong></p><p>This</p><ul><li>is</li><li>a</li></ul><p><strong>test</strong> of lis</p>`,
    //     );
    //   });

    //   it('cut lis', async () => {
    //     const doc = `<h1>Hoi</h1><p>This</p><ul><li>abc</li><li>123</li></ul><p><strong>test</strong> of lis</p>`;
    //     await loadDoc(doc);
    //     await selectRange('li', 1, 'li ~ li', 2);
    //     await clipboard.cut('[contenteditable]');
    //     await selectRange('li', 1);
    //     await clipboard.paste('[contenteditable]');
    //     expect(await serializeDoc()).toEqual(
    //       `<h1>Hoi</h1><p>This</p><ul><li>a</li><li>bc</li><li>12</li><li>3</li></ul><p><strong>test</strong> of lis</p>`,
    //     );
    //   });
  });
});
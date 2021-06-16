import playwright from 'playwright';
import path from 'path';
import proc from 'child_process';
import sirv from 'sirv';
import http from 'http';

type BrowserType = 'chromium' | 'webkit' | 'firefox';

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

async function initBrowser(browserType: BrowserType) {
  if (browser) {
    await browser.close();
  }
  browser = await playwright[browserType].launch({
    // To debug, uncomment the headless and slowMo options.
    // headless: false,
    // slowMo: 250,
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

function loadDoc(newDoc: string, { readonly } = { readonly: false }) {
  return page.evaluate(
    ([doc, readonly]) => {
      const tests = (window as any).integrationTests;
      const main = document.querySelector('main')!;
      main.innerHTML = '';
      tests.editor?.dispose();
      tests.editor = tests.minidoc({
        doc,
        readonly,
        middleware: [
          tests.minidocToolbar(tests.defaultToolbarActions),
          tests.cardMiddleware([tests.counterCard]),
        ],
      });
      main.append(tests.editor.toolbar.root, tests.editor.root);
    },
    [newDoc, readonly],
  );
}

function loadDefault() {
  return loadDoc(
    `
<h1>Hello</h1>
<h2>There</h2>
<p><strong>I'm strong</strong><a href="http://example.com">Foo</a><em>I'm emphasized</em><b>I'm bold</b><i>I'm italic</i></p>
`,
  );
}

function serializeDoc() {
  return page
    .evaluate(() => (window as any).integrationTests.editor.serialize())
    .then((s) => normalizeOutput(s.replace(/&nbsp;/g, ' ')));
}

/**
 * This normalizes spaces and trailing brs across the tests so that we can
 * check for those things in a uniform way. In reality, the variations don't
 * make a difference, so our tests are fine being fuzzy on these points.
 *
 * It also normalizes b / strong and i / em.
 * @param s
 */
function normalizeOutput(s: string) {
  return s
    .replace(/>( |&nbsp;)</g, '><br><')
    .replace(/([^>])<br></g, '$1<')
    .replace(/<b>/g, '<strong>')
    .replace(/<\/b>/g, '</strong>')
    .replace(/<i>/g, '<em>')
    .replace(/<\/i>/g, '</em>');
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

/**
 * This hackery gets around a Chromium bug where clicks seem to return
 * before the focus completes properly. If a test is randomly failing,
 * use this click instead of the built in page click and see if that fixes it.
 */
async function click(selector: string) {
  await page.click(selector);
  return page.waitForFunction((s) => {
    const el = document.getSelection()?.getRangeAt(0).startContainer;
    return (el instanceof Element ? el : el?.parentElement)?.closest(s);
  }, selector);
}

function execClipboardEvent(selector: string, name: string) {
  return page.evaluate(
    ({ selector, name }: { selector: string; name: string }) => {
      const el = document.querySelector(selector);
      const e = new CustomEvent(name);
      const win = window as any;
      win.puppeteerClipboard = win.puppeteerClipboard || new Map();
      (e as any).clipboardData = {
        files: [],
        getData(k: string) {
          return win.puppeteerClipboard.get(k);
        },
        setData(k: string, v: any) {
          win.puppeteerClipboard.set(k, v);
        },
      };
      el?.dispatchEvent(e);
    },
    { selector, name },
  );
}

const clipboard = {
  copy: (selector: string) => execClipboardEvent(selector, 'copy'),
  cut: (selector: string) => execClipboardEvent(selector, 'cut'),
  paste: (selector: string) => execClipboardEvent(selector, 'paste'),
};

async function press(...keys: string[]) {
  for (const k of keys) {
    await page.keyboard.down(k);
  }

  return Promise.all(keys.map((k) => page.keyboard.up(k)));
}

function pressCtrl(key: string) {
  return page.keyboard.press('Control+' + key);
}

function runTestsForBrowser(browserType: BrowserType) {
  describe(`minidoc ${browserType}`, () => {
    let server: http.Server;

    beforeAll(buildTestScript);

    beforeAll(async () => {
      server = await runTestServer(testPort);
      await initBrowser(browserType);
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

      it('selects a whole line with triple clicks and toggles h1', async () => {
        const toolbarDoc = `<p>Hello friend</p><p>How are you?</p>`;
        await loadDoc(toolbarDoc);
        await page.click('p', { clickCount: 3 });
        await page.click('[aria-label="Heading 1"]');
        expect(await serializeDoc()).toEqual(`<h1>Hello friend</h1><p>How are you?</p>`);
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
          `<h1>Hello</h1><h2>There</h2><p>I'm strong<a href="http://example.com">Foo</a><em>I'm emphasized</em><strong>I'm bold</strong><em>I'm italic</em></p>`,
        );
        await selectNodeContent('b');
        await page.click('[aria-label="Bold"]');
        expect(await serializeDoc()).toEqual(
          `<h1>Hello</h1><h2>There</h2><p>I'm strong<a href="http://example.com">Foo</a><em>I'm emphasized</em>I'm bold<em>I'm italic</em></p>`,
        );
        await page.click('[aria-label="Bold"]');
        expect(await serializeDoc()).toEqual(
          `<h1>Hello</h1><h2>There</h2><p>I'm strong<a href="http://example.com">Foo</a><em>I'm emphasized</em><strong>I'm bold</strong><em>I'm italic</em></p>`,
        );
        await selectRange('p', 0);
        await pressCtrl('b');
        await page.type('p', 'Yall');
        expect(await serializeDoc()).toEqual(
          `<h1>Hello</h1><h2>There</h2><p><strong>Yall</strong>I'm strong<a href="http://example.com">Foo</a><em>I'm emphasized</em><strong>I'm bold</strong><em>I'm italic</em></p>`,
        );
      });

      it('italic and unitalic', async () => {
        await selectNodeContent('em');
        await page.click('[aria-label="Italic"]');
        expect(await serializeDoc()).toEqual(
          `<h1>Hello</h1><h2>There</h2><p><strong>I'm strong</strong><a href="http://example.com">Foo</a>I'm emphasized<strong>I'm bold</strong><em>I'm italic</em></p>`,
        );
        await selectNodeContent('i');
        await page.click('[aria-label="Italic"]');
        expect(await serializeDoc()).toEqual(
          `<h1>Hello</h1><h2>There</h2><p><strong>I'm strong</strong><a href="http://example.com">Foo</a>I'm emphasized<strong>I'm bold</strong>I'm italic</p>`,
        );
        await page.click('[aria-label="Italic"]');
        expect(await serializeDoc()).toEqual(
          `<h1>Hello</h1><h2>There</h2><p><strong>I'm strong</strong><a href="http://example.com">Foo</a>I'm emphasized<strong>I'm bold</strong><em>I'm italic</em></p>`,
        );
        await selectRange('p', 0);
        await pressCtrl('i');
        await page.type('p', 'Yall');
        expect(await serializeDoc()).toEqual(
          `<h1>Hello</h1><h2>There</h2><p><strong><em>Yall</em>I'm strong</strong><a href="http://example.com">Foo</a>I'm emphasized<strong>I'm bold</strong><em>I'm italic</em></p>`,
        );
      });

      it('triple click, bold, italic, with br does not produce loads of empty brs and elements', async () => {
        const toolbarDoc = `<p>Hello there<br></p>`;
        await loadDoc(toolbarDoc);
        await page.click('p', { clickCount: 3 });
        await page.click('[aria-label="Bold"]');
        await page.click('[aria-label="Italic"]');
        await page.click('[aria-label="Bold"]');
        await page.click('[aria-label="Italic"]');
        expect(await serializeDoc()).toEqual(`<p>Hello there</p>`);
      });

      it('bold and backspacing', async () => {
        await loadDoc(`<h1>Hello</h1><p>Stuff goes here</p>`);
        await selectRange('p', 6, 'p', 10);
        await pressCtrl('b');
        expect(await serializeDoc()).toEqual(
          `<h1>Hello</h1><p>Stuff <strong>goes</strong> here</p>`,
        );
        await selectRange('strong', 4, 'strong', 4);
        await press('Backspace');
        await press('Backspace');
        await press('Backspace');
        await press('Backspace');
        expect(await serializeDoc()).toEqual(`<h1>Hello</h1><p>Stuff  here</p>`);
        await page.type('[contenteditable]', 'goes');
        expect(await serializeDoc()).toEqual(
          `<h1>Hello</h1><p>Stuff <strong>goes</strong> here</p>`,
        );
        await selectRange('b,strong', 0, 'b,strong', 4);
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
          `<h1>Hello</h1><h2>There</h2><p><strong>I'm strong</strong><a href="/foo/bar">Foo</a><em>I'm emphasized</em><strong>I'm bold</strong><em>I'm italic</em></p>`,
        );
        await page.waitForSelector('[aria-label="Link"]');
        await page.click('[aria-label="Link"]');
        await page.waitForSelector('.minidoc-toolbar-txt');
        const btnUnlink = await findByText('button', 'Unlink');
        await btnUnlink.click();
        await page.waitForFunction(() => !document.querySelector('.minidoc-highlighter'));
        expect(await serializeDoc()).toEqual(
          `<h1>Hello</h1><h2>There</h2><p><strong>I'm strong</strong>Foo<em>I'm emphasized</em><strong>I'm bold</strong><em>I'm italic</em></p>`,
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
          `<h1>Hello</h1><h2><a target="_blank" href="/xoxo">There</a></h2><ul><li>Fella</li></ul><p>You</p><p>Guys</p>`,
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
    });

    describe('selection', () => {
      beforeAll(() => page.reload());

      async function deleteWithKey(key: string) {
        const toolbarDoc = `<h1>Hello</h1><h2>There</h2><p><strong>I'm strong</strong><em>I'm emphasized</em></p><p>New P <b>I'm bold</b><i>I'm italic</i></p>`;
        await loadDoc(toolbarDoc);
        await selectRange('h1', 2, 'strong', 3);
        await press(key);
        expect(await serializeDoc()).toEqual(
          `<h1>He<strong> strong</strong><em>I'm emphasized</em></h1><p>New P <strong>I'm bold</strong><em>I'm italic</em></p>`,
        );
        await page.keyboard.type('yo');
        expect(await serializeDoc()).toEqual(
          `<h1>Heyo<strong> strong</strong><em>I'm emphasized</em></h1><p>New P <strong>I'm bold</strong><em>I'm italic</em></p>`,
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

      it('enter with a trailing space', async () => {
        const toolbarDoc = `<p>Hello world</p>`;
        await loadDoc(toolbarDoc);
        await selectRange('p', 6);
        await press('Enter');
        expect(await serializeDoc()).toEqual(`<p>Hello </p><p>world</p>`);
        await selectRange('p', 6);
        await press('Enter');
        // Webkit and Chromium are inconsistent with the trailing space, but it doesn't really matter,
        // so we just eliminate it as a hacky workaround.
        expect((await serializeDoc()).replace(' ', '')).toEqual(
          `<p>Hello</p><p><br></p><p>world</p>`,
        );
        await page.type('[contenteditable]', 'stuff');
        expect((await serializeDoc()).replace(' ', '')).toEqual(
          `<p>Hello</p><p>stuff</p><p>world</p>`,
        );
      });

      it('enter with a leading space', async () => {
        const toolbarDoc = `<p>Hello world</p>`;
        await loadDoc(toolbarDoc);
        await selectRange('p', 5);
        await press('Enter');
        expect(await serializeDoc()).toEqual(`<p>Hello</p><p> world</p>`);
        await selectRange('p', 0);
        await selectRange('p + p', 0);
        await press('Enter');
        // Webkit and Chromium are inconsistent with the trailing space, but it doesn't really matter,
        // so we just eliminate it as a hacky workaround.
        expect((await serializeDoc()).replace(' ', '')).toEqual(
          `<p>Hello</p><p><br></p><p>world</p>`,
        );
      });

      it('select and type', async () => {
        const toolbarDoc = `<h1>Hello</h1><h2>There</h2><p><strong>I'm strong</strong><em>I'm emphasized</em></p><p>New P <b>I'm bold</b><i>I'm italic</i></p>`;
        await loadDoc(toolbarDoc);
        await selectRange('h1', 2, 'strong', 3);
        await page.keyboard.type('man');
        expect(await serializeDoc()).toEqual(
          `<h1>Heman<strong> strong</strong><em>I'm emphasized</em></h1><p>New P <strong>I'm bold</strong><em>I'm italic</em></p>`,
        );
        await page.keyboard.type('yo');
        expect(await serializeDoc()).toEqual(
          `<h1>Hemanyo<strong> strong</strong><em>I'm emphasized</em></h1><p>New P <strong>I'm bold</strong><em>I'm italic</em></p>`,
        );
      });

      it('select and enter', async () => {
        const toolbarDoc = `<h1>Hello</h1><h2>There</h2><p><strong>I'm strong</strong><em>I'm emphasized</em></p><p>New P <b>I'm bold</b><i>I'm italic</i></p>`;
        await loadDoc(toolbarDoc);
        await selectRange('h1', 2, 'strong', 3);
        await press('Enter');
        expect(await serializeDoc()).toEqual(
          `<h1>He</h1><p><strong> strong</strong><em>I'm emphasized</em></p><p>New P <strong>I'm bold</strong><em>I'm italic</em></p>`,
        );
        await page.keyboard.type('yo');
        expect(await serializeDoc()).toEqual(
          `<h1>He</h1><p><strong>yo strong</strong><em>I'm emphasized</em></p><p>New P <strong>I'm bold</strong><em>I'm italic</em></p>`,
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
          `<h1>Hello</h1><h2>There<strong>I'm strong</strong><em>I'm emphasized</em></h2><p>New P <strong>I'm bold</strong><em>I'm italic</em></p>`,
        );
        await page.keyboard.type('yo');
        expect(await serializeDoc()).toEqual(
          `<h1>Hello</h1><h2>Thereyo<strong>I'm strong</strong><em>I'm emphasized</em></h2><p>New P <strong>I'm bold</strong><em>I'm italic</em></p>`,
        );
      });

      it('backspace at end of element', async () => {
        const toolbarDoc = `<h1>Hello</h1><h2>There</h2><p><strong>I'm strong</strong><em>I'm emphasized</em></p><p>New P <b>I'm bold</b><i>I'm italic</i></p>`;
        await loadDoc(toolbarDoc);
        await selectRange('h1', 5, 'h1', 5);
        await press('Backspace');
        expect(await serializeDoc()).toEqual(
          `<h1>Hell</h1><h2>There</h2><p><strong>I'm strong</strong><em>I'm emphasized</em></p><p>New P <strong>I'm bold</strong><em>I'm italic</em></p>`,
        );
        await page.keyboard.type('yo');
        expect(await serializeDoc()).toEqual(
          `<h1>Hellyo</h1><h2>There</h2><p><strong>I'm strong</strong><em>I'm emphasized</em></p><p>New P <strong>I'm bold</strong><em>I'm italic</em></p>`,
        );
      });

      it('inline copy and paste', async () => {
        const doc = `<h1>Hoi</h1><p>This is using i and b instead of em and strong. <b>Does</b> it <i>work</i>?. Well, here's an <em>em</em></p>`;
        await loadDoc(doc);
        await selectRange('p', 0, 'em', 2);
        await clipboard.copy('[contenteditable]');
        await page.click('h1');
        await clipboard.paste('[contenteditable]');
        expect(await serializeDoc()).toEqual(
          `<h1>HoiThis is using i and b instead of em and strong. <strong>Does</strong> it <em>work</em>?. Well, here's an <em>em</em></h1><p>This is using i and b instead of em and strong. <strong>Does</strong> it <em>work</em>?. Well, here's an <em>em</em></p>`,
        );
      });

      it('multiline copy and paste', async () => {
        const doc = `<h1>Hello world</h1><p>This <strong>MUST</strong> work.</p><p>But does it?</p><p>Eh?</p>`;
        await loadDoc(doc);
        await selectRange('h1', 6, 'p', 4);
        await clipboard.copy('[contenteditable]');
        await selectRange('p:last-child', 0);
        await clipboard.paste('[contenteditable]');
        expect(await serializeDoc()).toEqual(
          `<h1>Hello world</h1><p>This <strong>MUST</strong> work.</p><p>But does it?</p><h1>world</h1><p>ThisEh?</p>`,
        );
      });

      it('multiline copy and paste with undo / redo', async () => {
        const doc = `<h1>Hello world</h1><p>This <strong>MUST</strong> work.</p><p>But does it?</p><p><br></p>`;
        await loadDoc(doc);
        await selectRange('h1', 6, 'p', 4);
        await clipboard.copy('[contenteditable]');
        await selectRange('p:last-child', 0);
        await clipboard.paste('[contenteditable]');
        expect(await serializeDoc()).toEqual(
          `<h1>Hello world</h1><p>This <strong>MUST</strong> work.</p><p>But does it?</p><h1>world</h1><p>This</p>`,
        );
        await pressCtrl('z');
        expect(await serializeDoc()).toEqual(
          `<h1>Hello world</h1><p>This <strong>MUST</strong> work.</p><p>But does it?</p><p><br></p>`,
        );
        await pressCtrl('y');
        expect(await serializeDoc()).toEqual(
          `<h1>Hello world</h1><p>This <strong>MUST</strong> work.</p><p>But does it?</p><h1>world</h1><p>This</p>`,
        );
        await page.type('[contenteditable]', '???');
        expect(await serializeDoc()).toEqual(
          `<h1>Hello world</h1><p>This <strong>MUST</strong> work.</p><p>But does it?</p><h1>world</h1><p>This???</p>`,
        );
      });

      it('multiline copy and paste normalizes the first element', async () => {
        const doc = `<h1>Hello world</h1><p>This <strong>MUST</strong> work.</p><p>But does it?</p><p>Eh?</p>`;
        await loadDoc(doc);
        await selectRange('h1', 6, 'p', 4);
        await clipboard.copy('[contenteditable]');
        await selectRange('p:last-child', 3);
        await clipboard.paste('[contenteditable]');
        expect(await serializeDoc()).toEqual(
          `<h1>Hello world</h1><p>This <strong>MUST</strong> work.</p><p>But does it?</p><p>Eh?world</p><p>This</p>`,
        );
      });
    });

    describe('cards', () => {
      beforeAll(() => page.reload());

      it('paste does not write into a card', async () => {
        const doc = `<h1>Hello</h1><button data-count="0">Count is 0</button><h2>There</h2><p><strong>I'm strong</strong><em>I'm emphasized</em></p>`;
        await loadDoc(doc);
        await click('p');
        await selectNodeContent('p');
        await clipboard.copy('[contenteditable]');
        await click('mini-card');
        await clipboard.paste('[contenteditable]');
        expect(await serializeDoc()).toEqual(
          `<h1>Hello</h1><button data-count="0">Count is 0</button><p><strong>I'm strong</strong><em>I'm emphasized</em></p><h2>There</h2><p><strong>I'm strong</strong><em>I'm emphasized</em></p>`,
        );
      });

      it('cards have access to the readonly property on the editor', async () => {
        const doc = `<h1>Hello</h1><button data-count="0">Count is 0</button><h2>There</h2><p><strong>I'm strong</strong><em>I'm emphasized</em></p>`;
        await loadDoc(doc, { readonly: true });
        const editorCount = await page.evaluate(
          () => document.querySelectorAll('[contenteditable=true]').length,
        );
        expect(editorCount).toEqual(0);
        expect(await page.textContent('mini-card')).toContain('(readonly)');
      });

      it('cards are copiable', async () => {
        const doc = `<h1>Hello</h1><h2>There</h2><button data-count="0">Count is 0</button><p><strong>I'm strong</strong><em>I'm emphasized</em></p>`;
        await loadDoc(doc);
        await click('mini-card');
        await clipboard.copy('[contenteditable]');
        await clipboard.paste('[contenteditable]');
        expect(await serializeDoc()).toEqual(
          `<h1>Hello</h1><h2>There</h2><button data-count="0">Count is 0</button><button data-count="0">Count is 0</button><p><strong>I'm strong</strong><em>I'm emphasized</em></p>`,
        );
      });

      it('cards are pastable in other elements', async () => {
        const doc = `<h1>Hello</h1><p>There</p><button data-count="0">Count is 0</button><p>End</p>`;
        await loadDoc(doc);
        await click('mini-card');
        await clipboard.copy('[contenteditable]');
        await selectRange('p', 1);
        await clipboard.paste('[contenteditable]');
        expect(await serializeDoc()).toEqual(
          `<h1>Hello</h1><p>T</p><button data-count="0">Count is 0</button><p>here</p><button data-count="0">Count is 0</button><p>End</p>`,
        );
      });

      it('cards are cuttable', async () => {
        const doc = `<h1>Hello</h1><h2>There</h2><button data-count="0">Count is 0</button><p><strong>I'm strong</strong><em>I'm emphasized</em></p>`;
        await loadDoc(doc);
        await click('mini-card');
        await clipboard.cut('[contenteditable]');
        expect(await serializeDoc()).toEqual(
          `<h1>Hello</h1><h2>There</h2><p><strong>I'm strong</strong><em>I'm emphasized</em></p>`,
        );
        await clipboard.paste('[contenteditable]');
        expect(await serializeDoc()).toEqual(
          `<h1>Hello</h1><h2>There</h2><button data-count="0">Count is 0</button><p><strong>I'm strong</strong><em>I'm emphasized</em></p>`,
        );
      });

      it('pressing enter in a card', async () => {
        const doc = `<h1>Hello</h1><button data-count="0">Count is 0</button><h2>There</h2><p><strong>I'm strong</strong><em>I'm emphasized</em></p>`;
        await loadDoc(doc);
        await click('mini-card');
        await press('Enter');
        expect(await serializeDoc()).toEqual(
          `<h1>Hello</h1><button data-count="0">Count is 0</button><p><br></p><h2>There</h2><p><strong>I'm strong</strong><em>I'm emphasized</em></p>`,
        );
        await page.keyboard.type('Hoi!');
        expect(await serializeDoc()).toEqual(
          `<h1>Hello</h1><button data-count="0">Count is 0</button><p>Hoi!</p><h2>There</h2><p><strong>I'm strong</strong><em>I'm emphasized</em></p>`,
        );
      });

      it('cards can be backspaced', async () => {
        const doc = `<h1>Hello</h1><button data-count="0">Count is 0</button><h2>There</h2><p><strong>I'm strong</strong><em>I'm emphasized</em></p>`;
        await loadDoc(doc);
        await click('mini-card');
        await press('Backspace');
        expect(await serializeDoc()).toEqual(
          `<h1>Hello</h1><p><br></p><h2>There</h2><p><strong>I'm strong</strong><em>I'm emphasized</em></p>`,
        );
        await page.keyboard.type('Hoi!');
        expect(await serializeDoc()).toEqual(
          `<h1>Hello</h1><p>Hoi!</p><h2>There</h2><p><strong>I'm strong</strong><em>I'm emphasized</em></p>`,
        );
      });

      it('cards can be deleted', async () => {
        const doc = `<h1>Hello</h1><button data-count="0">Count is 0</button><h2>There</h2><p><strong>I'm strong</strong><em>I'm emphasized</em></p>`;
        await loadDoc(doc);
        await click('mini-card');
        await press('Delete');
        expect(await serializeDoc()).toEqual(
          `<h1>Hello</h1><p><br></p><h2>There</h2><p><strong>I'm strong</strong><em>I'm emphasized</em></p>`,
        );
        await page.keyboard.type('Hoi!');
        expect(await serializeDoc()).toEqual(
          `<h1>Hello</h1><p>Hoi!</p><h2>There</h2><p><strong>I'm strong</strong><em>I'm emphasized</em></p>`,
        );
      });

      it('deleting into a block', async () => {
        const doc = `<h1>Hello</h1><button data-count="0">Count is 0</button><h2>There</h2><p><strong>I'm strong</strong><em>I'm emphasized</em></p>`;
        await loadDoc(doc);
        await selectRange('h1', 5, 'h1', 5);
        await press('Delete');
        expect(await serializeDoc()).toEqual(
          `<h1>Hello</h1><button data-count="0">Count is 0</button><h2>There</h2><p><strong>I'm strong</strong><em>I'm emphasized</em></p>`,
        );
        await press('Delete');
        expect(await serializeDoc()).toEqual(
          `<h1>Hello</h1><p><br></p><h2>There</h2><p><strong>I'm strong</strong><em>I'm emphasized</em></p>`,
        );
        await press('Delete');
        expect(await serializeDoc()).toEqual(
          `<h1>Hello</h1><p>There</p><p><strong>I'm strong</strong><em>I'm emphasized</em></p>`,
        );
      });

      it('backspacing into a block', async () => {
        const doc = `<h1>Hello</h1><button data-count="0">Count is 0</button><h2>There</h2><p><strong>I'm strong</strong><em>I'm emphasized</em></p>`;
        await loadDoc(doc);
        await selectRange('h2', 0, 'h2', 0);
        await press('Backspace');
        expect(await serializeDoc()).toEqual(
          `<h1>Hello</h1><button data-count="0">Count is 0</button><h2>There</h2><p><strong>I'm strong</strong><em>I'm emphasized</em></p>`,
        );
        await press('Backspace');
        expect(await serializeDoc()).toEqual(
          `<h1>Hello</h1><p><br></p><h2>There</h2><p><strong>I'm strong</strong><em>I'm emphasized</em></p>`,
        );
        await press('Backspace');
        expect(await serializeDoc()).toEqual(
          `<h1>Hello</h1><h2>There</h2><p><strong>I'm strong</strong><em>I'm emphasized</em></p>`,
        );
      });

      it('undo / redo adds and removes cards', async () => {
        await loadDoc(`<h1>Hello</h1><button data-count="7">Count is 7</button><p>You</p>`);
        await selectRange('h1', 0, 'p', 0);
        await page.keyboard.type('Hi ');
        expect(await serializeDoc()).toEqual(`<h1>Hi You</h1>`);
        await pressCtrl('z');
        expect(await serializeDoc()).toEqual(
          `<h1>Hello</h1><button data-count="7">Count is 7</button><p>You</p>`,
        );
        await pressCtrl('y');
        expect(await serializeDoc()).toEqual(`<h1>Hi You</h1>`);
      });
    });

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

      it('backspace first empty li', async () => {
        await loadDoc(
          `<h1>Hello</h1><ul><li><br><ul><li>1</li><li>2</li></ul></li><li>B</li><li>C</li></ul><p>Ze end!</p>`,
        );
        await selectRange('li', 0);
        await press('Backspace');
        expect(await serializeDoc()).toEqual(
          `<h1>Hello</h1><p><br></p><ul><li>1</li><li>2</li><li>B</li><li>C</li></ul><p>Ze end!</p>`,
        );
        await page.keyboard.type('stuff');
        expect(await serializeDoc()).toEqual(
          `<h1>Hello</h1><p>stuff</p><ul><li>1</li><li>2</li><li>B</li><li>C</li></ul><p>Ze end!</p>`,
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

      it('cut ol lis and paste into an empty p', async () => {
        const doc = `<h1>Hoi</h1><p><br></p><p>cough</p><ol><li>abc</li><li>123</li></ol>`;
        await loadDoc(doc);
        await selectRange('li', 1, 'li ~ li', 2);
        await clipboard.cut('[contenteditable]');
        await selectRange('p', 0, 'p', 0);
        await clipboard.paste('[contenteditable]');
        expect(await serializeDoc()).toEqual(
          `<h1>Hoi</h1><ol><li>bc</li><li>12</li></ol><p>cough</p><ol><li>a3</li></ol>`,
        );
      });

      it('cut ol lis and paste into a non-empty empty p', async () => {
        const doc = `<h1>Hoi</h1><p>Hello</p><ol><li>abc</li><li>123</li></ol>`;
        await loadDoc(doc);
        await selectRange('li', 1, 'li ~ li', 2);
        await clipboard.cut('[contenteditable]');
        await selectRange('p', 1, 'p', 1);
        await clipboard.paste('[contenteditable]');
        expect(await serializeDoc()).toEqual(
          `<h1>Hoi</h1><p>H</p><ol><li>bc</li><li>12</li></ol><p>ello</p><ol><li>a3</li></ol>`,
        );
      });

      it('copy a p and paste into a ul', async () => {
        const doc = `<h1>Hoi</h1><p>Hello</p><ol><li>abc</li><li>123</li></ol>`;
        await loadDoc(doc);
        await selectRange('p', 0, 'p', 5);
        await clipboard.copy('[contenteditable]');
        await selectRange('li', 0);
        await clipboard.paste('[contenteditable]');
        expect(await serializeDoc()).toEqual(
          `<h1>Hoi</h1><p>Hello</p><ol><li>Helloabc</li><li>123</li></ol>`,
        );
      });

      it('copy list', async () => {
        const doc = `<h1>Hoi</h1><p>This</p><ul><li>is</li><li>a</li></ul><p><strong>test</strong> of lis</p>`;
        await loadDoc(doc);
        await selectRange('p', 0, 'strong', 2);
        await clipboard.copy('[contenteditable]');
        await selectRange('p', 0);
        await clipboard.paste('[contenteditable]');
        expect(await serializeDoc()).toEqual(
          `<h1>Hoi</h1><p>This</p><ul><li>is</li><li>a</li></ul><p><strong>te</strong>This</p><ul><li>is</li><li>a</li></ul><p><strong>test</strong> of lis</p>`,
        );
      });

      it('copy sublist', async () => {
        const doc = `<h1>Hoi</h1><ul><li>a<ul><li>1</li><li>2</li></ul></li><li>b</li></ul><p>This is a p</p>`;
        await loadDoc(doc);
        await selectRange('li', 0, 'p', 3);
        await clipboard.copy('[contenteditable]');
        await selectRange('> ul > li:last-child', 1);
        await clipboard.paste('[contenteditable]');
        expect(await serializeDoc()).toEqual(
          `<h1>Hoi</h1><ul><li>a<ul><li>1</li><li>2</li></ul></li><li>ba<ul><li>1</li><li>2</li></ul></li><li>b</li></ul><p>Thi</p><p>This is a p</p>`,
        );
      });

      it('cut lis', async () => {
        const doc = `<h1>Hoi</h1><p>This</p><ul><li>abc</li><li>123</li></ul><p><strong>test</strong> of lis</p>`;
        await loadDoc(doc);
        await selectRange('li', 1, 'li ~ li', 2);
        await clipboard.cut('[contenteditable]');
        await selectRange('li', 1);
        expect(await serializeDoc()).toEqual(
          `<h1>Hoi</h1><p>This</p><ul><li>a3</li></ul><p><strong>test</strong> of lis</p>`,
        );
        await clipboard.paste('[contenteditable]');
        expect(await serializeDoc()).toEqual(
          `<h1>Hoi</h1><p>This</p><ul><li>abc</li><li>123</li></ul><p><strong>test</strong> of lis</p>`,
        );
      });
    });

    describe('horizontal rules', () => {
      it('adds a horizontal rule when --- is typed on a new line', async () => {
        await loadDoc(`<h1>Hello</h1><p><br></p><p>World</p>`);
        await selectRange('p', 0);
        await page.keyboard.type('---');
        expect(await serializeDoc()).toEqual(
          `<h1>Hello</h1><hr contenteditable="false"><p><br></p><p>World</p>`,
        );
      });
    });

    describe('highlighting', () => {
      it('highlights a single selection', async () => {
        await loadDoc(`<h1>Hello</h1><p>World</p>`);
        await selectRange('p', 0, 'p', 5);
        await page.click('[aria-label="Highlight"]');
        await page.click('[aria-label="Red"]');
        expect(await serializeDoc()).toEqual(
          `<h1>Hello</h1><p><mini-color data-bg="red">World</mini-color></p>`,
        );
      });

      it('clears the highlight', async () => {
        await loadDoc(`<h1>Hello</h1><p><mini-color data-bg="blue">World</mini-color></p>`);
        await selectRange('mini-color', 0, 'mini-color', 5);
        await page.click('[aria-label="Highlight"]');
        await page.click('.minidoc-clear-highlight');
        expect(await serializeDoc()).toEqual(`<h1>Hello</h1><p>World</p>`);
      });
    });
  });
}

// TODO: support firefox
// runTestsForBrowser('firefox');
runTestsForBrowser('webkit');
runTestsForBrowser('chromium');

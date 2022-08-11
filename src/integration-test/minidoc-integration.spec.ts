import { test, expect, Page } from '@playwright/test';

test.beforeEach(async ({ page, baseURL }) => {
  await page.goto(baseURL!);
});

function editorEl(selector: string) {
  return `.minidoc-editor ${selector}`;
}

async function loadDefault({ page }: { page: Page }) {
  const util = pageUtil(page);
  await util.loadDoc(
    `
<h1>Hello</h1>
<h2>There</h2>
<p><strong>I'm strong</strong><a href="http://example.com">Foo</a><em>I'm emphasized</em><b>I'm bold</b><i>I'm italic</i></p>
`,
  );
  await page.click('p');
}

const it = (
  desc: string,
  handler: (args: { util: ReturnType<typeof pageUtil>; page: Page }) => any,
) =>
  test(desc, ({ page }) => {
    const util = pageUtil(page);
    return handler({ page, util });
  });

export const fit = (
  desc: string,
  handler: (args: { util: ReturnType<typeof pageUtil>; page: Page }) => any,
) =>
  test.only(desc, ({ page }) => {
    const util = pageUtil(page);
    return handler({ page, util });
  });

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

function execClipboardEvent(page: Page, selector: string, name: string, value?: string) {
  return page.evaluate(
    ({ selector, name, value }: { selector: string; name: string; value?: string }) => {
      const el = document.querySelector(selector);
      const e = new CustomEvent(name);
      const win = window as any;
      win.puppeteerClipboard = win.puppeteerClipboard || new Map();
      (e as any).clipboardData = {
        files: [],
        getData(k: string) {
          return value || win.puppeteerClipboard.get(k);
        },
        setData(k: string, v: any) {
          win.puppeteerClipboard.set(k, v);
        },
      };
      el?.dispatchEvent(e);
    },
    { selector, name, value },
  );
}

const pageUtil = (page: Page) => ({
  page,
  copy: (selector: string) => execClipboardEvent(page, selector, 'copy'),
  cut: (selector: string) => execClipboardEvent(page, selector, 'cut'),
  paste: (selector: string, value?: string) => execClipboardEvent(page, selector, 'paste', value),

  async press(...keys: string[]) {
    for (const k of keys) {
      await page.keyboard.down(k);
    }

    return Promise.all(keys.map((k) => page.keyboard.up(k)));
  },

  async findByText(selector: string, text: string) {
    const x = await page.evaluateHandle(
      ({ selector, text }) => {
        const els = document.querySelectorAll(selector);
        return Array.from(els).find((el) => el.textContent === text);
      },
      { selector, text },
    );
    const el = x.asElement();
    if (!el) {
      throw new Error(`Could not find ${selector} with ${text}`);
    }
    return el;
  },

  async selectNodeContent(selector: string) {
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
  },

  pressCtrl(key: string) {
    return page.keyboard.press('Control+' + key);
  },

  async serializeDoc() {
    const s = await page.evaluate(() => (window as any).integrationTests.editor.serialize());
    return normalizeOutput(s.replace(/&nbsp;/g, ' '));
  },

  isActiveToolbarButton(selector: string) {
    return page.waitForSelector(`${selector}.minidoc-toolbar-btn-active`);
  },

  async selectRange(
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
  },

  loadDoc(newDoc: string, { readonly } = { readonly: false }) {
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
  },
});

test.describe('clipboard', () => {
  it('auto-detects links', async ({ util }) => {
    const doc = `<p><br></p>`;
    await util.loadDoc(doc);
    await util.selectRange('p', 0);
    await util.paste(
      '[contenteditable]',
      '<p>This is a link http://foo.bar/baz does it work?</p><p>https://example.com?stuff=yup</p>',
    );
    expect(await util.serializeDoc()).toEqual(
      `<p>This is a link <a href="http://foo.bar/baz">http://foo.bar/baz</a> does it work?</p><p><a href="https://example.com?stuff=yup">https://example.com?stuff=yup</a></p>`,
    );
  });

  it('scrubs whacky markup', async ({ util }) => {
    const doc = `<p><br></p>`;
    await util.loadDoc(doc);
    await util.selectRange('p', 0);
    await util.paste(
      '[contenteditable]',
      '<div>Stuff<h1 style="color:red">Hello, there!</h1>And whatnot<ol><li>Shazm</li></ol></div>',
    );
    expect(await util.serializeDoc()).toEqual(
      `<p>Stuff</p><h1>Hello, there!</h1><p>And whatnot</p><ol><li>Shazm</li></ol>`,
    );
  });
});

test.describe('toolbar', () => {
  test.beforeEach(loadDefault);

  it('highlights the bold button when in a strong or b', async ({ util, page }) => {
    await page.click('.minidoc-editor strong');
    expect(await util.isActiveToolbarButton('[aria-label="Bold"]')).toBeTruthy();
    await page.click('.minidoc-editor b');
    expect(await util.isActiveToolbarButton('[aria-label="Bold"]')).toBeTruthy();
  });

  it('highlights the i button when in a strong or b', async ({ util, page }) => {
    await page.click('.minidoc-editor em');
    expect(await util.isActiveToolbarButton('[aria-label="Italic"]')).toBeTruthy();
    await page.click('.minidoc-editor i');
    expect(await util.isActiveToolbarButton('[aria-label="Italic"]')).toBeTruthy();
  });

  it('highlights the link button when in a link', async ({ util, page }) => {
    await page.click('[href="http://example.com"]');
    expect(await util.isActiveToolbarButton('[aria-label="Link"]')).toBeTruthy();
  });

  it('highlights the h1 button when in an h1', async ({ util, page }) => {
    await page.click('h1');
    expect(await util.isActiveToolbarButton('[aria-label="Heading 1"]')).toBeTruthy();
  });

  it('highlights the h2 button when in an h1', async ({ util, page }) => {
    await page.click('h2');
    expect(await util.isActiveToolbarButton('[aria-label="Heading 2"]')).toBeTruthy();
  });

  it('toggles h1', async ({ util, page }) => {
    const toolbarDoc = `<h1>Hello</h1><h2>There</h2><p>You</p>`;
    await util.loadDoc(toolbarDoc);
    await page.click('h1');
    await page.click('[aria-label="Heading 1"]');
    expect(await util.serializeDoc()).toEqual(`<p>Hello</p><h2>There</h2><p>You</p>`);
    await page.keyboard.type('Focused?');
    expect(await util.serializeDoc()).toEqual(`<p>Focused?</p><h2>There</h2><p>You</p>`);
    await page.click('[aria-label="Heading 1"]');
    expect(await util.serializeDoc()).toEqual(`<h1>Focused?</h1><h2>There</h2><p>You</p>`);
  });

  it('selects a whole line with triple clicks and toggles h1', async ({ page, util }) => {
    const toolbarDoc = `<p>Hello friend</p><p>How are you?</p>`;
    await util.loadDoc(toolbarDoc);
    await page.click('p', { clickCount: 3 });
    await page.click('[aria-label="Heading 1"]');
    expect(await util.serializeDoc()).toEqual(`<h1>Hello friend</h1><p>How are you?</p>`);
  });

  it('toggles h2', async ({ util, page }) => {
    const toolbarDoc = `<h1>Hello</h1><h2>There</h2><p>You</p>`;
    await util.loadDoc(toolbarDoc);
    await page.click('h2');
    await page.click('[aria-label="Heading 2"]');
    expect(await util.serializeDoc()).toEqual(`<h1>Hello</h1><p>There</p><p>You</p>`);
    await page.keyboard.type('Focused?');
    expect(await util.serializeDoc()).toEqual(`<h1>Hello</h1><p>Focused?</p><p>You</p>`);
    await page.click('[aria-label="Heading 2"]');
    expect(await util.serializeDoc()).toEqual(`<h1>Hello</h1><h2>Focused?</h2><p>You</p>`);
  });

  it('new ul', async ({ util, page }) => {
    const toolbarDoc = `<h1>Hello</h1><p><br /></p>`;
    await util.loadDoc(toolbarDoc);
    await page.click('p');
    await page.click('[aria-label="Bullet list"]');
    await page.type('[contenteditable]', 'this is in an li');
    expect(await util.serializeDoc()).toEqual(`<h1>Hello</h1><ul><li>this is in an li</li></ul>`);
  });

  it('select li and type', async ({ util, page }) => {
    const toolbarDoc = `<ul><li>what gives?</li></ul>`;
    await util.loadDoc(toolbarDoc);
    await util.selectRange('li', 0, 'li', 11);
    await util.press('Backspace');
    expect(await util.serializeDoc()).toEqual(`<ul><li><br></li></ul>`);
    await page.type('[contenteditable]', 'ahem');
    expect(await util.serializeDoc()).toEqual(`<ul><li>ahem</li></ul>`);
  });

  it('toggles uls', async ({ util, page }) => {
    const toolbarDoc = `<h1>Hello</h1><h2>There</h2><ol><li>Fella</li></ol><p>You</p><p>Guys</p>`;
    await util.loadDoc(toolbarDoc);
    await util.selectRange('h2', 0, 'p', 1);
    await page.click('[aria-label="Bullet list"]');
    expect(await util.serializeDoc()).toEqual(
      `<h1>Hello</h1><ul><li>There</li><li>Fella</li><li>You</li></ul><p>Guys</p>`,
    );
    await page.click('[aria-label="Bullet list"]');
    expect(await util.serializeDoc()).toEqual(
      `<h1>Hello</h1><p>There</p><p>Fella</p><p>You</p><p>Guys</p>`,
    );
    await page.click('[aria-label="Bullet list"]');
    expect(await util.serializeDoc()).toEqual(
      `<h1>Hello</h1><ul><li>There</li><li>Fella</li><li>You</li></ul><p>Guys</p>`,
    );
  });

  it('toggles ols', async ({ util, page }) => {
    const toolbarDoc = `<h1>Hello</h1><h2>There</h2><ul><li>Fella</li></ul><p>You</p><p>Guys</p>`;
    await util.loadDoc(toolbarDoc);
    await util.selectRange('h2', 0, 'p', 1);
    await page.click('[aria-label="Ordered list"]');
    expect(await util.serializeDoc()).toEqual(
      `<h1>Hello</h1><ol><li>There</li><li>Fella</li><li>You</li></ol><p>Guys</p>`,
    );
    await page.click('[aria-label="Ordered list"]');
    expect(await util.serializeDoc()).toEqual(
      `<h1>Hello</h1><p>There</p><p>Fella</p><p>You</p><p>Guys</p>`,
    );
    await page.click('[aria-label="Ordered list"]');
    expect(await util.serializeDoc()).toEqual(
      `<h1>Hello</h1><ol><li>There</li><li>Fella</li><li>You</li></ol><p>Guys</p>`,
    );
  });

  it('bold and unbold', async ({ page, util }) => {
    await util.selectNodeContent('strong');
    await page.click('[aria-label="Bold"]');
    expect(await util.serializeDoc()).toEqual(
      `<h1>Hello</h1><h2>There</h2><p>I'm strong<a href="http://example.com">Foo</a><em>I'm emphasized</em><strong>I'm bold</strong><em>I'm italic</em></p>`,
    );
    await util.selectNodeContent('b');
    await page.click('[aria-label="Bold"]');
    expect(await util.serializeDoc()).toEqual(
      `<h1>Hello</h1><h2>There</h2><p>I'm strong<a href="http://example.com">Foo</a><em>I'm emphasized</em>I'm bold<em>I'm italic</em></p>`,
    );
    await page.click('[aria-label="Bold"]');
    expect(await util.serializeDoc()).toEqual(
      `<h1>Hello</h1><h2>There</h2><p>I'm strong<a href="http://example.com">Foo</a><em>I'm emphasized</em><strong>I'm bold</strong><em>I'm italic</em></p>`,
    );
    await util.selectRange('p', 0);
    await util.pressCtrl('b');
    await page.keyboard.type('Yall');
    expect(await util.serializeDoc()).toEqual(
      `<h1>Hello</h1><h2>There</h2><p><strong>Yall</strong>I'm strong<a href="http://example.com">Foo</a><em>I'm emphasized</em><strong>I'm bold</strong><em>I'm italic</em></p>`,
    );
  });

  it('italic and unitalic', async ({ page, util }) => {
    await util.selectNodeContent('em');
    await page.click('[aria-label="Italic"]');
    expect(await util.serializeDoc()).toEqual(
      `<h1>Hello</h1><h2>There</h2><p><strong>I'm strong</strong><a href="http://example.com">Foo</a>I'm emphasized<strong>I'm bold</strong><em>I'm italic</em></p>`,
    );
    await util.selectNodeContent('i');
    await page.click('[aria-label="Italic"]');
    expect(await util.serializeDoc()).toEqual(
      `<h1>Hello</h1><h2>There</h2><p><strong>I'm strong</strong><a href="http://example.com">Foo</a>I'm emphasized<strong>I'm bold</strong>I'm italic</p>`,
    );
    await page.click('[aria-label="Italic"]');
    expect(await util.serializeDoc()).toEqual(
      `<h1>Hello</h1><h2>There</h2><p><strong>I'm strong</strong><a href="http://example.com">Foo</a>I'm emphasized<strong>I'm bold</strong><em>I'm italic</em></p>`,
    );
    await util.selectRange('p', 0);
    await util.pressCtrl('i');
    await page.keyboard.type('Yall');
    expect(await util.serializeDoc()).toEqual(
      `<h1>Hello</h1><h2>There</h2><p><strong><em>Yall</em>I'm strong</strong><a href="http://example.com">Foo</a>I'm emphasized<strong>I'm bold</strong><em>I'm italic</em></p>`,
    );
  });

  it('triple click, bold, italic, with br does not produce loads of empty brs and elements', async ({
    page,
    util,
  }) => {
    const toolbarDoc = `<p>Hello there<br></p>`;
    await util.loadDoc(toolbarDoc);
    await page.click('p', { clickCount: 3 });
    await page.click('[aria-label="Bold"]');
    await page.click('[aria-label="Italic"]');
    await page.click('[aria-label="Bold"]');
    await page.click('[aria-label="Italic"]');
    expect(await util.serializeDoc()).toEqual(`<p>Hello there</p>`);
  });

  it('bold and backspacing', async ({ util, page }) => {
    await util.loadDoc(`<h1>Hello</h1><p>Stuff goes here</p>`);
    await util.selectRange('p', 6, 'p', 10);
    await util.pressCtrl('b');
    expect(await util.serializeDoc()).toEqual(
      `<h1>Hello</h1><p>Stuff <strong>goes</strong> here</p>`,
    );
    await util.selectRange('strong', 4, 'strong', 4);
    await util.press('Backspace');
    await util.press('Backspace');
    await util.press('Backspace');
    await util.press('Backspace');
    expect(await util.serializeDoc()).toEqual(`<h1>Hello</h1><p>Stuff  here</p>`);
    await page.type('[contenteditable]', 'goes');
    expect(await util.serializeDoc()).toEqual(
      `<h1>Hello</h1><p>Stuff <strong>goes</strong> here</p>`,
    );
    await util.selectRange('b,strong', 0, 'b,strong', 4);
    await util.pressCtrl('b');
    expect(await util.serializeDoc()).toEqual(`<h1>Hello</h1><p>Stuff goes here</p>`);
    await util.press('Backspace');
    expect(await util.serializeDoc()).toEqual(`<h1>Hello</h1><p>Stuff  here</p>`);
  });

  it('link and unlink', async ({ page, util }) => {
    await util.selectNodeContent('a');
    await page.click('[aria-label="Link"]');
    await page.waitForSelector('.minidoc-toolbar-txt');
    await page.keyboard.type('/foo/bar');
    const btnLink = await util.findByText('button', 'Link');
    await btnLink.click();
    await page.waitForSelector('[href="/foo/bar"]');
    expect(await util.serializeDoc()).toEqual(
      `<h1>Hello</h1><h2>There</h2><p><strong>I'm strong</strong><a href="/foo/bar">Foo</a><em>I'm emphasized</em><strong>I'm bold</strong><em>I'm italic</em></p>`,
    );
    await page.waitForSelector('[aria-label="Link"]');
    await page.click('[aria-label="Link"]');
    await page.waitForSelector('.minidoc-toolbar-txt');
    const btnUnlink = await util.findByText('button', 'Unlink');
    await btnUnlink.click();
    await page.waitForFunction(() => !document.querySelector('.minidoc-highlighter'));
    expect(await util.serializeDoc()).toEqual(
      `<h1>Hello</h1><h2>There</h2><p><strong>I'm strong</strong>Foo<em>I'm emphasized</em><strong>I'm bold</strong><em>I'm italic</em></p>`,
    );
  });

  it('multiline link and unlink', async ({ page, util }) => {
    const toolbarDoc = `<h1>Hello</h1><h2>There</h2><ul><li>Fella</li></ul><p>You</p><p>Guys</p>`;
    await util.loadDoc(toolbarDoc);
    await util.selectRange('h2', 0, 'p', 1);
    await page.click('[aria-label="Link"]');
    await page.waitForSelector('.minidoc-toolbar-txt');
    await page.keyboard.type('/xoxo');
    const btnLink = await util.findByText('button', 'Link');
    await btnLink.click();
    expect(await util.serializeDoc()).toEqual(
      `<h1>Hello</h1><h2><a href="/xoxo">There</a></h2><ul><li>Fella</li></ul><p>You</p><p>Guys</p>`,
    );
    await page.waitForSelector('[aria-label="Link"]');
    await page.click('[aria-label="Link"]');
    await page.waitForSelector('.minidoc-toolbar-txt');
    const btnUnlink = await util.findByText('button', 'Unlink');
    await btnUnlink.click();
    await page.waitForFunction(() => !document.querySelector('.minidoc-highlighter'));
    expect(await util.serializeDoc()).toEqual(
      `<h1>Hello</h1><h2>There</h2><ul><li>Fella</li></ul><p>You</p><p>Guys</p>`,
    );
  });
});

test.describe('selection', () => {
  async function deleteWithKey(util: ReturnType<typeof pageUtil>, key: string) {
    const toolbarDoc = `<h1>Hello</h1><h2>There</h2><p><strong>I'm strong</strong><em>I'm emphasized</em></p><p>New P <b>I'm bold</b><i>I'm italic</i></p>`;
    await util.loadDoc(toolbarDoc);
    await util.selectRange('h1', 2, 'strong', 3);
    await util.press(key);
    expect(await util.serializeDoc()).toEqual(
      `<h1>He<strong> strong</strong><em>I'm emphasized</em></h1><p>New P <strong>I'm bold</strong><em>I'm italic</em></p>`,
    );
    await util.page.keyboard.type('yo');
    expect(await util.serializeDoc()).toEqual(
      `<h1>Heyo<strong> strong</strong><em>I'm emphasized</em></h1><p>New P <strong>I'm bold</strong><em>I'm italic</em></p>`,
    );
  }

  it('select and delete', ({ util }) => deleteWithKey(util, 'Delete'));
  it('select and backspace', ({ util }) => deleteWithKey(util, 'Backspace'));

  it('enter in an h1', async ({ util }) => {
    const toolbarDoc = `<h1>Hello</h1>`;
    await util.loadDoc(toolbarDoc);
    await util.selectRange('h1', 5);
    await util.press('Enter');
    expect(await util.serializeDoc()).toEqual(`<h1>Hello</h1><p><br></p>`);
    await util.page.keyboard.type('yo');
    expect(await util.serializeDoc()).toEqual(`<h1>Hello</h1><p>yo</p>`);
  });

  it('enter with a trailing space', async ({ util }) => {
    const toolbarDoc = `<p>Hello world</p>`;
    await util.loadDoc(toolbarDoc);
    await util.selectRange('p', 6);
    await util.press('Enter');
    expect(await util.serializeDoc()).toEqual(`<p>Hello </p><p>world</p>`);
    await util.selectRange('p', 6);
    await util.press('Enter');
    // Webkit and Chromium are inconsistent with the trailing space, but it doesn't really matter,
    // so we just eliminate it as a hacky workaround.
    expect((await util.serializeDoc()).replace(' ', '')).toEqual(
      `<p>Hello</p><p><br></p><p>world</p>`,
    );
    await util.page.type('[contenteditable]', 'stuff');
    expect((await util.serializeDoc()).replace(' ', '')).toEqual(
      `<p>Hello</p><p>stuff</p><p>world</p>`,
    );
  });

  it('enter with a leading space', async ({ util }) => {
    const toolbarDoc = `<p>Hello world</p>`;
    await util.loadDoc(toolbarDoc);
    await util.selectRange('p', 5);
    await util.press('Enter');
    expect(await util.serializeDoc()).toEqual(`<p>Hello</p><p> world</p>`);
    await util.selectRange('p', 0);
    await util.selectRange('p + p', 0);
    await util.press('Enter');
    // Webkit and Chromium are inconsistent with the trailing space, but it doesn't really matter,
    // so we just eliminate it as a hacky workaround.
    expect((await util.serializeDoc()).replace(' ', '')).toEqual(
      `<p>Hello</p><p><br></p><p>world</p>`,
    );
  });

  it('ctrl and enter does not insert a new line', async ({ util }) => {
    await util.loadDoc(`<p>Hello world</p>`);
    await util.selectRange('p', 11);

    // Enter should insert a new line
    await util.press('Enter');
    const withNewLine = `<p>Hello world</p><p><br></p>`;
    expect(await util.serializeDoc()).toEqual(withNewLine);

    // Ctrl+Enter should not insert anything
    await util.pressCtrl('Enter');
    expect(await util.serializeDoc()).toEqual(withNewLine);
  });

  it('select and type', async ({ util }) => {
    const toolbarDoc = `<h1>Hello</h1><h2>There</h2><p><strong>I'm strong</strong><em>I'm emphasized</em></p><p>New P <b>I'm bold</b><i>I'm italic</i></p>`;
    await util.loadDoc(toolbarDoc);
    await util.selectRange('h1', 2, 'strong', 3);
    await util.page.keyboard.type('man');
    expect(await util.serializeDoc()).toEqual(
      `<h1>Heman<strong> strong</strong><em>I'm emphasized</em></h1><p>New P <strong>I'm bold</strong><em>I'm italic</em></p>`,
    );
    await util.page.keyboard.type('yo');
    expect(await util.serializeDoc()).toEqual(
      `<h1>Hemanyo<strong> strong</strong><em>I'm emphasized</em></h1><p>New P <strong>I'm bold</strong><em>I'm italic</em></p>`,
    );
  });

  it('select and enter', async ({ util }) => {
    const toolbarDoc = `<h1>Hello</h1><h2>There</h2><p><strong>I'm strong</strong><em>I'm emphasized</em></p><p>New P <b>I'm bold</b><i>I'm italic</i></p>`;
    await util.loadDoc(toolbarDoc);
    await util.selectRange('h1', 2, 'strong', 3);
    await util.press('Enter');
    expect(await util.serializeDoc()).toEqual(
      `<h1>He</h1><p><strong> strong</strong><em>I'm emphasized</em></p><p>New P <strong>I'm bold</strong><em>I'm italic</em></p>`,
    );
    await util.page.keyboard.type('yo');
    expect(await util.serializeDoc()).toEqual(
      `<h1>He</h1><p><strong>yo strong</strong><em>I'm emphasized</em></p><p>New P <strong>I'm bold</strong><em>I'm italic</em></p>`,
    );
  });

  it('select and enter in an h1', async ({ util }) => {
    const toolbarDoc = `<h1>Hello there</h1>`;
    await util.loadDoc(toolbarDoc);
    await util.selectRange('h1', 5, 'h1', 6);
    await util.press('Enter');
    expect(await util.serializeDoc()).toEqual(`<h1>Hello</h1><h1>there</h1>`);
    await util.page.keyboard.type('yo');
    expect(await util.serializeDoc()).toEqual(`<h1>Hello</h1><h1>yothere</h1>`);
  });

  it('backspace at start of element 1', async ({ util }) => {
    const toolbarDoc = `<h1>Hello</h1><h2>There</h2>`;
    await util.loadDoc(toolbarDoc);
    await util.selectRange('h2', 0, 'h2', 0);
    await util.press('Backspace');
    expect(await util.serializeDoc()).toEqual(`<h1>HelloThere</h1>`);
    await util.page.keyboard.type('yo');
    expect(await util.serializeDoc()).toEqual(`<h1>HelloyoThere</h1>`);
  });

  it('delete at start of element', async ({ util }) => {
    const toolbarDoc = `<h1>Hello</h1>`;
    await util.loadDoc(toolbarDoc);
    await util.selectRange('h1', 0, 'h1', 0);
    await util.press('Delete');
    expect(await util.serializeDoc()).toEqual(`<h1>ello</h1>`);
    await util.page.keyboard.type('yo');
    expect(await util.serializeDoc()).toEqual(`<h1>yoello</h1>`);
  });

  it('delete at end of element', async ({ util }) => {
    const toolbarDoc = `<h1>Hello</h1><h2>There</h2><p>Stuff</p>`;
    await util.loadDoc(toolbarDoc);
    await util.selectRange('h1', 5, 'h1', 5);
    await util.press('Delete');
    expect(await util.serializeDoc()).toEqual(`<h1>HelloThere</h1><p>Stuff</p>`);
    await util.page.keyboard.type('yo');
    expect(await util.serializeDoc()).toEqual(`<h1>HelloyoThere</h1><p>Stuff</p>`);
  });

  it('backspace at start of element 2', async ({ util }) => {
    const toolbarDoc = `<h1>Hello</h1><h2>There</h2><p><strong>I'm strong</strong><em>I'm emphasized</em></p><p>New P <b>I'm bold</b><i>I'm italic</i></p>`;
    await util.loadDoc(toolbarDoc);
    await util.selectRange('p', 0, 'p', 0);
    await util.press('Backspace');
    expect(await util.serializeDoc()).toEqual(
      `<h1>Hello</h1><h2>There<strong>I'm strong</strong><em>I'm emphasized</em></h2><p>New P <strong>I'm bold</strong><em>I'm italic</em></p>`,
    );
    await util.page.keyboard.type('yo');
    expect(await util.serializeDoc()).toEqual(
      `<h1>Hello</h1><h2>Thereyo<strong>I'm strong</strong><em>I'm emphasized</em></h2><p>New P <strong>I'm bold</strong><em>I'm italic</em></p>`,
    );
  });

  it('backspace at end of element', async ({ util }) => {
    const toolbarDoc = `<h1>Hello</h1><h2>There</h2><p><strong>I'm strong</strong><em>I'm emphasized</em></p><p>New P <b>I'm bold</b><i>I'm italic</i></p>`;
    await util.loadDoc(toolbarDoc);
    await util.selectRange('h1', 5, 'h1', 5);
    await util.press('Backspace');
    expect(await util.serializeDoc()).toEqual(
      `<h1>Hell</h1><h2>There</h2><p><strong>I'm strong</strong><em>I'm emphasized</em></p><p>New P <strong>I'm bold</strong><em>I'm italic</em></p>`,
    );
    await util.page.keyboard.type('yo');
    expect(await util.serializeDoc()).toEqual(
      `<h1>Hellyo</h1><h2>There</h2><p><strong>I'm strong</strong><em>I'm emphasized</em></p><p>New P <strong>I'm bold</strong><em>I'm italic</em></p>`,
    );
  });

  it('inline copy and paste', async ({ util }) => {
    const doc = `<h1>Hoi</h1><p>This is using i and b instead of em and strong. <b>Does</b> it <i>work</i>?. Well, here's an <em>em</em></p>`;
    await util.loadDoc(doc);
    await util.selectRange('p', 0, 'em', 2);
    await util.copy('[contenteditable]');
    await util.page.click('h1');
    await util.paste('[contenteditable]');
    expect(await util.serializeDoc()).toEqual(
      `<h1>HoiThis is using i and b instead of em and strong. <strong>Does</strong> it <em>work</em>?. Well, here's an <em>em</em></h1><p>This is using i and b instead of em and strong. <strong>Does</strong> it <em>work</em>?. Well, here's an <em>em</em></p>`,
    );
  });

  it('multiline copy and paste', async ({ util }) => {
    const doc = `<h1>Hello world</h1><p>This <strong>MUST</strong> work.</p><p>But does it?</p><p>Eh?</p>`;
    await util.loadDoc(doc);
    await util.selectRange('h1', 6, 'p', 4);
    await util.copy('[contenteditable]');
    await util.selectRange('p:last-child', 0);
    await util.paste('[contenteditable]');
    expect(await util.serializeDoc()).toEqual(
      `<h1>Hello world</h1><p>This <strong>MUST</strong> work.</p><p>But does it?</p><h1>world</h1><p>ThisEh?</p>`,
    );
  });

  it('multiline copy and paste with undo / redo', async ({ util }) => {
    const doc = `<h1>Hello world</h1><p>This <strong>MUST</strong> work.</p><p>But does it?</p><p><br></p>`;
    await util.loadDoc(doc);
    await util.selectRange('h1', 6, 'p', 4);
    await util.copy('[contenteditable]');
    await util.selectRange('p:last-child', 0);
    await util.paste('[contenteditable]');
    expect(await util.serializeDoc()).toEqual(
      `<h1>Hello world</h1><p>This <strong>MUST</strong> work.</p><p>But does it?</p><h1>world</h1><p>This</p>`,
    );
    await util.pressCtrl('z');
    expect(await util.serializeDoc()).toEqual(
      `<h1>Hello world</h1><p>This <strong>MUST</strong> work.</p><p>But does it?</p><p><br></p>`,
    );
    await util.pressCtrl('y');
    expect(await util.serializeDoc()).toEqual(
      `<h1>Hello world</h1><p>This <strong>MUST</strong> work.</p><p>But does it?</p><h1>world</h1><p>This</p>`,
    );
    await util.page.type('[contenteditable]', '???');
    expect(await util.serializeDoc()).toEqual(
      `<h1>Hello world</h1><p>This <strong>MUST</strong> work.</p><p>But does it?</p><h1>world</h1><p>This???</p>`,
    );
  });

  it('multiline copy and paste normalizes the first element', async ({ util }) => {
    const doc = `<h1>Hello world</h1><p>This <strong>MUST</strong> work.</p><p>But does it?</p><p>Eh?</p>`;
    await util.loadDoc(doc);
    await util.selectRange('h1', 6, 'p', 4);
    await util.copy('[contenteditable]');
    await util.selectRange('p:last-child', 3);
    await util.paste('[contenteditable]');
    expect(await util.serializeDoc()).toEqual(
      `<h1>Hello world</h1><p>This <strong>MUST</strong> work.</p><p>But does it?</p><p>Eh?world</p><p>This</p>`,
    );
  });
});

test.describe('cards', () => {
  it('paste does not write into a card', async ({ util }) => {
    const doc = `<h1>Hello</h1><button data-count="0">Count is 0</button><h2>There</h2><p><strong>I'm strong</strong><em>I'm emphasized</em></p>`;
    await util.loadDoc(doc);
    await util.page.click('p');
    await util.selectNodeContent('p');
    await util.copy('[contenteditable]');
    await util.page.click('mini-card');
    await util.paste('[contenteditable]');
    expect(await util.serializeDoc()).toEqual(
      `<h1>Hello</h1><button data-count="0">Count is 0</button><p><strong>I'm strong</strong><em>I'm emphasized</em></p><h2>There</h2><p><strong>I'm strong</strong><em>I'm emphasized</em></p>`,
    );
  });

  it('cards have access to the readonly property on the editor', async ({ util }) => {
    const doc = `<h1>Hello</h1><button data-count="0">Count is 0</button><h2>There</h2><p><strong>I'm strong</strong><em>I'm emphasized</em></p>`;
    await util.loadDoc(doc, { readonly: true });
    const editorCount = await util.page.evaluate(
      () => document.querySelectorAll('[contenteditable=true]').length,
    );
    expect(editorCount).toEqual(0);
    expect(await util.page.textContent('mini-card')).toContain('(readonly)');
  });

  it('cards are promoted to leaf nodes', async ({ util }) => {
    const doc = `<p>Hello<button data-count="0">Count is 0</button>World!</p>`;
    await util.loadDoc(doc);
    expect(await util.serializeDoc()).toEqual(
      `<p>Hello</p><button data-count="0">Count is 0</button><p>World!</p>`,
    );
  });

  it('cards are copiable', async ({ util }) => {
    const doc = `<h1>Hello</h1><h2>There</h2><button data-count="0">Count is 0</button><p><strong>I'm strong</strong><em>I'm emphasized</em></p>`;
    await util.loadDoc(doc);
    await util.page.click('mini-card');
    await util.copy('[contenteditable]');
    await util.paste('[contenteditable]');
    expect(await util.serializeDoc()).toEqual(
      `<h1>Hello</h1><h2>There</h2><button data-count="0">Count is 0</button><button data-count="0">Count is 0</button><p><strong>I'm strong</strong><em>I'm emphasized</em></p>`,
    );
  });

  it('cards are pastable in other elements', async ({ util }) => {
    const doc = `<h1>Hello</h1><p>There</p><button data-count="0">Count is 0</button><p>End</p>`;
    await util.loadDoc(doc);
    await util.page.click('mini-card');
    await util.copy('[contenteditable]');
    await util.selectRange('p', 1);
    await util.paste('[contenteditable]');
    expect(await util.serializeDoc()).toEqual(
      `<h1>Hello</h1><p>T</p><button data-count="0">Count is 0</button><p>here</p><button data-count="0">Count is 0</button><p>End</p>`,
    );
  });

  it('cards are cuttable', async ({ util }) => {
    const doc = `<h1>Hello</h1><h2>There</h2><button data-count="0">Count is 0</button><p><strong>I'm strong</strong><em>I'm emphasized</em></p>`;
    await util.loadDoc(doc);
    await util.page.click('mini-card');
    await util.cut('[contenteditable]');
    expect(await util.serializeDoc()).toEqual(
      `<h1>Hello</h1><h2>There</h2><p><strong>I'm strong</strong><em>I'm emphasized</em></p>`,
    );
    await util.paste('[contenteditable]');
    expect(await util.serializeDoc()).toEqual(
      `<h1>Hello</h1><h2>There</h2><button data-count="0">Count is 0</button><p><strong>I'm strong</strong><em>I'm emphasized</em></p>`,
    );
  });

  it('pressing enter in a card', async ({ util }) => {
    const doc = `<h1>Hello</h1><button data-count="0">Count is 0</button><h2>There</h2><p><strong>I'm strong</strong><em>I'm emphasized</em></p>`;
    await util.loadDoc(doc);
    await util.page.click('mini-card');
    await util.press('Enter');
    expect(await util.serializeDoc()).toEqual(
      `<h1>Hello</h1><button data-count="0">Count is 0</button><p><br></p><h2>There</h2><p><strong>I'm strong</strong><em>I'm emphasized</em></p>`,
    );
    await util.page.keyboard.type('Hoi!');
    expect(await util.serializeDoc()).toEqual(
      `<h1>Hello</h1><button data-count="0">Count is 0</button><p>Hoi!</p><h2>There</h2><p><strong>I'm strong</strong><em>I'm emphasized</em></p>`,
    );
  });

  it('cards can be backspaced', async ({ util }) => {
    const doc = `<h1>Hello</h1><button data-count="0">Count is 0</button><h2>There</h2><p><strong>I'm strong</strong><em>I'm emphasized</em></p>`;
    await util.loadDoc(doc);
    await util.page.click('mini-card');
    await util.press('Backspace');
    expect(await util.serializeDoc()).toEqual(
      `<h1>Hello</h1><p><br></p><h2>There</h2><p><strong>I'm strong</strong><em>I'm emphasized</em></p>`,
    );
    await util.page.keyboard.type('Hoi!');
    expect(await util.serializeDoc()).toEqual(
      `<h1>Hello</h1><p>Hoi!</p><h2>There</h2><p><strong>I'm strong</strong><em>I'm emphasized</em></p>`,
    );
  });

  it('cards can be deleted', async ({ util }) => {
    const doc = `<h1>Hello</h1><button data-count="0">Count is 0</button><h2>There</h2><p><strong>I'm strong</strong><em>I'm emphasized</em></p>`;
    await util.loadDoc(doc);
    await util.page.click('mini-card');
    await util.press('Delete');
    expect(await util.serializeDoc()).toEqual(
      `<h1>Hello</h1><p><br></p><h2>There</h2><p><strong>I'm strong</strong><em>I'm emphasized</em></p>`,
    );
    await util.page.keyboard.type('Hoi!');
    expect(await util.serializeDoc()).toEqual(
      `<h1>Hello</h1><p>Hoi!</p><h2>There</h2><p><strong>I'm strong</strong><em>I'm emphasized</em></p>`,
    );
  });

  it('deleting into a block', async ({ util }) => {
    const doc = `<h1>Hello</h1><button data-count="0">Count is 0</button><h2>There</h2><p><strong>I'm strong</strong><em>I'm emphasized</em></p>`;
    await util.loadDoc(doc);
    await util.selectRange('h1', 5, 'h1', 5);
    await util.press('Delete');
    expect(await util.serializeDoc()).toEqual(
      `<h1>Hello</h1><button data-count="0">Count is 0</button><h2>There</h2><p><strong>I'm strong</strong><em>I'm emphasized</em></p>`,
    );
    await util.press('Delete');
    expect(await util.serializeDoc()).toEqual(
      `<h1>Hello</h1><p><br></p><h2>There</h2><p><strong>I'm strong</strong><em>I'm emphasized</em></p>`,
    );
    await util.press('Delete');
    expect(await util.serializeDoc()).toEqual(
      `<h1>Hello</h1><p>There</p><p><strong>I'm strong</strong><em>I'm emphasized</em></p>`,
    );
  });

  it('backspacing into a block', async ({ util }) => {
    const doc = `<h1>Hello</h1><button data-count="0">Count is 0</button><h2>There</h2><p><strong>I'm strong</strong><em>I'm emphasized</em></p>`;
    await util.loadDoc(doc);
    await util.selectRange('h2', 0, 'h2', 0);
    await util.press('Backspace');
    expect(await util.serializeDoc()).toEqual(
      `<h1>Hello</h1><button data-count="0">Count is 0</button><h2>There</h2><p><strong>I'm strong</strong><em>I'm emphasized</em></p>`,
    );
    await util.press('Backspace');
    expect(await util.serializeDoc()).toEqual(
      `<h1>Hello</h1><p><br></p><h2>There</h2><p><strong>I'm strong</strong><em>I'm emphasized</em></p>`,
    );
    await util.press('Backspace');
    expect(await util.serializeDoc()).toEqual(
      `<h1>Hello</h1><h2>There</h2><p><strong>I'm strong</strong><em>I'm emphasized</em></p>`,
    );
  });

  it('undo / redo adds and removes cards', async ({ util }) => {
    await util.loadDoc(`<h1>Hello</h1><button data-count="7">Count is 7</button><p>You</p>`);
    await util.selectRange('h1', 0, 'p', 0);
    await util.page.keyboard.type('Hi ');
    expect(await util.serializeDoc()).toEqual(`<h1>Hi You</h1>`);
    await util.pressCtrl('z');
    expect(await util.serializeDoc()).toEqual(
      `<h1>Hello</h1><button data-count="7">Count is 7</button><p>You</p>`,
    );
    await util.pressCtrl('y');
    expect(await util.serializeDoc()).toEqual(`<h1>Hi You</h1>`);
  });
});

test.describe('lists', () => {
  it('tab / shift tab', async ({ util }) => {
    await util.loadDoc(`<h1>Hello</h1><ul><li>A</li><li>B</li><li>C</li></ul><p>Ze end!</p>`);
    await util.selectRange('li:nth-of-type(2)', 0);
    await util.press('Tab');
    expect(await util.serializeDoc()).toEqual(
      `<h1>Hello</h1><ul><li>A<ul><li>B</li></ul></li><li>C</li></ul><p>Ze end!</p>`,
    );
    await util.selectRange('li:nth-of-type(2)', 0);
    await util.press('Tab');
    expect(await util.serializeDoc()).toEqual(
      `<h1>Hello</h1><ul><li>A<ul><li>B</li><li>C</li></ul></li></ul><p>Ze end!</p>`,
    );
    await util.press('Shift', 'Tab');
    expect(await util.serializeDoc()).toEqual(
      `<h1>Hello</h1><ul><li>A<ul><li>B</li></ul></li><li>C</li></ul><p>Ze end!</p>`,
    );
  });

  it('backspace first li', async ({ util }) => {
    await util.loadDoc(
      `<h1>Hello</h1><ul><li>A<ul><li>1</li><li>2</li></ul></li><li>B</li><li>C</li></ul><p>Ze end!</p>`,
    );
    await util.selectRange('li', 0);
    await util.press('Backspace');
    expect(await util.serializeDoc()).toEqual(
      `<h1>Hello</h1><p>A</p><ul><li>1</li><li>2</li><li>B</li><li>C</li></ul><p>Ze end!</p>`,
    );
  });

  it('backspace first empty li', async ({ util }) => {
    await util.loadDoc(
      `<h1>Hello</h1><ul><li><br><ul><li>1</li><li>2</li></ul></li><li>B</li><li>C</li></ul><p>Ze end!</p>`,
    );
    await util.selectRange('li', 0);
    await util.press('Backspace');
    expect(await util.serializeDoc()).toEqual(
      `<h1>Hello</h1><p><br></p><ul><li>1</li><li>2</li><li>B</li><li>C</li></ul><p>Ze end!</p>`,
    );
    await util.page.keyboard.type('stuff');
    expect(await util.serializeDoc()).toEqual(
      `<h1>Hello</h1><p>stuff</p><ul><li>1</li><li>2</li><li>B</li><li>C</li></ul><p>Ze end!</p>`,
    );
  });

  it('backspace nested li', async ({ util }) => {
    await util.loadDoc(`<h1>Hello</h1><ul><li>A</li><li>B</li><li>C</li></ul><p>Ze end!</p>`);
    await util.selectRange('li ~ li', 0);
    await util.press('Backspace');
    expect(await util.serializeDoc()).toEqual(
      `<h1>Hello</h1><ul><li>AB</li><li>C</li></ul><p>Ze end!</p>`,
    );
    await util.page.keyboard.type(' through ');
    expect(await util.serializeDoc()).toEqual(
      `<h1>Hello</h1><ul><li>A through B</li><li>C</li></ul><p>Ze end!</p>`,
    );
  });

  it('backspace li selection', async ({ util }) => {
    await util.loadDoc(`<h1>Hello</h1><ul><li>abc</li><li>def</li><li>ghi</li></ul><p>Ze end!</p>`);
    await util.selectRange('li', 1, 'li ~ li', 1);
    await util.press('Backspace');
    expect(await util.serializeDoc()).toEqual(
      `<h1>Hello</h1><ul><li>aef</li><li>ghi</li></ul><p>Ze end!</p>`,
    );
    await util.page.keyboard.type(' through ');
    expect(await util.serializeDoc()).toEqual(
      `<h1>Hello</h1><ul><li>a through ef</li><li>ghi</li></ul><p>Ze end!</p>`,
    );
  });

  it('delete at end of li', async ({ util }) => {
    await util.loadDoc(`<h1>Hello</h1><ul><li>A</li><li>B</li><li>C</li></ul><p>Ze end!</p>`);
    await util.selectRange('li', 1);
    await util.press('Delete');
    expect(await util.serializeDoc()).toEqual(
      `<h1>Hello</h1><ul><li>AB</li><li>C</li></ul><p>Ze end!</p>`,
    );
    await util.page.keyboard.type(' through ');
    expect(await util.serializeDoc()).toEqual(
      `<h1>Hello</h1><ul><li>A through B</li><li>C</li></ul><p>Ze end!</p>`,
    );
  });

  it('delete at end of list', async ({ util }) => {
    await util.loadDoc(`<h1>Hello</h1><ul><li>A</li><li>B</li><li>C</li></ul><p>Ze end!</p>`);
    await util.selectRange('li:last-child', 1);
    await util.press('Delete');
    expect(await util.serializeDoc()).toEqual(
      `<h1>Hello</h1><ul><li>A</li><li>B</li><li>CZe end!</li></ul>`,
    );
    await util.page.keyboard.type(' through ');
    expect(await util.serializeDoc()).toEqual(
      `<h1>Hello</h1><ul><li>A</li><li>B</li><li>C through Ze end!</li></ul>`,
    );
  });

  it('enter at start of last li', async ({ util }) => {
    await util.loadDoc(`<h1>Hello</h1><ul><li>A</li><li>B</li><li>C</li></ul><p>Ze end!</p>`);
    await util.selectRange('li:last-child', 0);
    await util.press('Enter');
    expect(await util.serializeDoc()).toEqual(
      `<h1>Hello</h1><ul><li>A</li><li>B</li><li><br></li><li>C</li></ul><p>Ze end!</p>`,
    );
  });

  it('enter at end of last li', async ({ util }) => {
    await util.loadDoc(`<h1>Hello</h1><ul><li>A</li><li>B</li><li>C</li></ul><p>Ze end!</p>`);
    await util.selectRange('li:last-child', 1);
    await util.press('Enter');
    await util.press('Enter');
    expect(await util.serializeDoc()).toEqual(
      `<h1>Hello</h1><ul><li>A</li><li>B</li><li>C</li></ul><p><br></p><p>Ze end!</p>`,
    );
  });

  it('enter within text of last li', async ({ util }) => {
    await util.loadDoc(`<h1>Hello</h1><ul><li>A</li><li>B</li><li>Cats</li></ul><p>Ze end!</p>`);
    await util.selectRange('li:last-child', 1);
    await util.press('Enter');
    expect(await util.serializeDoc()).toEqual(
      `<h1>Hello</h1><ul><li>A</li><li>B</li><li>C</li><li>ats</li></ul><p>Ze end!</p>`,
    );
  });

  it('cut ol lis and paste into an empty p', async ({ util }) => {
    const doc = `<h1>Hoi</h1><p><br></p><p>cough</p><ol><li>abc</li><li>123</li></ol>`;
    await util.loadDoc(doc);
    await util.selectRange('li', 1, 'li ~ li', 2);
    await util.cut('[contenteditable]');
    await util.selectRange('p', 0, 'p', 0);
    await util.paste('[contenteditable]');
    expect(await util.serializeDoc()).toEqual(
      `<h1>Hoi</h1><ol><li>bc</li><li>12</li></ol><p>cough</p><ol><li>a3</li></ol>`,
    );
  });

  it('cut ol lis and paste into a non-empty empty p', async ({ util }) => {
    const doc = `<h1>Hoi</h1><p>Hello</p><ol><li>abc</li><li>123</li></ol>`;
    await util.loadDoc(doc);
    await util.selectRange('li', 1, 'li ~ li', 2);
    await util.cut('[contenteditable]');
    await util.selectRange('p', 1, 'p', 1);
    await util.paste('[contenteditable]');
    expect(await util.serializeDoc()).toEqual(
      `<h1>Hoi</h1><p>H</p><ol><li>bc</li><li>12</li></ol><p>ello</p><ol><li>a3</li></ol>`,
    );
  });

  it('copy a p and paste into a ul', async ({ util }) => {
    const doc = `<h1>Hoi</h1><p>Hello</p><ol><li>abc</li><li>123</li></ol>`;
    await util.loadDoc(doc);
    await util.selectRange('p', 0, 'p', 5);
    await util.copy('[contenteditable]');
    await util.selectRange('li', 0);
    await util.paste('[contenteditable]');
    expect(await util.serializeDoc()).toEqual(
      `<h1>Hoi</h1><p>Hello</p><ol><li>Helloabc</li><li>123</li></ol>`,
    );
  });

  it('copy list', async ({ util }) => {
    const doc = `<h1>Hoi</h1><p>This</p><ul><li>is</li><li>a</li></ul><p><strong>test</strong> of lis</p>`;
    await util.loadDoc(doc);
    await util.selectRange('p', 0, 'strong', 2);
    await util.copy('[contenteditable]');
    await util.selectRange('p', 0);
    await util.paste('[contenteditable]');
    expect(await util.serializeDoc()).toEqual(
      `<h1>Hoi</h1><p>This</p><ul><li>is</li><li>a</li></ul><p><strong>te</strong>This</p><ul><li>is</li><li>a</li></ul><p><strong>test</strong> of lis</p>`,
    );
  });

  it('copy sublist', async ({ util }) => {
    const doc = `<h1>Hoi</h1><ul><li>a<ul><li>1</li><li>2</li></ul></li><li>b</li></ul><p>This is a p</p>`;
    await util.loadDoc(doc);
    await util.selectRange('li', 0, 'p', 3);
    await util.copy('[contenteditable]');
    await util.selectRange('> ul > li:last-child', 1);
    await util.paste('[contenteditable]');
    expect(await util.serializeDoc()).toEqual(
      `<h1>Hoi</h1><ul><li>a<ul><li>1</li><li>2</li></ul></li><li>ba<ul><li>1</li><li>2</li></ul></li><li>b</li></ul><p>Thi</p><p>This is a p</p>`,
    );
  });

  it('cut lis', async ({ util }) => {
    const doc = `<h1>Hoi</h1><p>This</p><ul><li>abc</li><li>123</li></ul><p><strong>test</strong> of lis</p>`;
    await util.loadDoc(doc);
    await util.selectRange('li', 1, 'li ~ li', 2);
    await util.cut('[contenteditable]');
    await util.selectRange('li', 1);
    expect(await util.serializeDoc()).toEqual(
      `<h1>Hoi</h1><p>This</p><ul><li>a3</li></ul><p><strong>test</strong> of lis</p>`,
    );
    await util.paste('[contenteditable]');
    expect(await util.serializeDoc()).toEqual(
      `<h1>Hoi</h1><p>This</p><ul><li>abc</li><li>123</li></ul><p><strong>test</strong> of lis</p>`,
    );
  });
});

test.describe('horizontal rules', () => {
  it('adds a horizontal rule when --- is typed on a new line', async ({ util }) => {
    await util.loadDoc(`<h1>Hello</h1><p><br></p><p>World</p>`);
    await util.selectRange('p', 0);
    await util.page.keyboard.type('---');
    expect(await util.serializeDoc()).toEqual(
      `<h1>Hello</h1><hr contenteditable="false"><p><br></p><p>World</p>`,
    );
  });
});

test.describe('highlighting', () => {
  it('highlights a single selection', async ({ util }) => {
    await util.loadDoc(`<h1>Hello</h1><p>World</p>`);
    await util.selectRange('p', 0, 'p', 5);
    await util.page.click('[aria-label="Highlight"]');
    await util.page.click('[aria-label="Red"]');
    expect(await util.serializeDoc()).toEqual(
      `<h1>Hello</h1><p><mark data-bg="red">World</mark></p>`,
    );
  });

  it('clears the highlight', async ({ util }) => {
    await util.loadDoc(`<h1>Hello</h1><p><mark data-bg="blue">World</mark></p>`);
    await util.selectRange('mark', 0, 'mark', 5);
    await util.page.click('[aria-label="Highlight"]');
    await util.page.click('.minidoc-clear-highlight');
    expect(await util.serializeDoc()).toEqual(`<h1>Hello</h1><p>World</p>`);
  });
});

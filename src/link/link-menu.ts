import * as Rng from '../range';
import * as Dom from '../dom';
import { h } from '../dom';
import { onMount } from '../disposable';
import { ToolbarButton, Submenu } from '../toolbar';

export function LinkMenu(editor: MinidocToolbarEditor) {
  const range = Rng.currentRange();
  if (!range) {
    return;
  }
  const a = Dom.closest('a', Rng.toNode(range));
  let href = Dom.attr('href', a) || '';
  const hide = () => editor.toolbar.setMenu(undefined);
  const unlink = () => {
    Dom.replaceSelfWithChildren(a);
    hide();
  };
  const link = () => {
    if (!href) {
      return unlink();
    }
    if (a) {
      Dom.assignAttrs({ href }, a);
    } else {
      range?.insertNode(h('a', { href }, range.collapsed ? href : range.extractContents()));
    }
    hide();
  };
  const txt = h<HTMLInputElement>('input.minidoc-toolbar-txt', {
    placeholder: 'Enter a URL',
    autofocus: 'true',
    value: href,
    oninput(e: any) {
      href = e.target.value;
    },
    onkeydown(e: KeyboardEvent) {
      if (e.key === 'Enter') {
        e.preventDefault();
        link();
      }
    },
  });

  onMount(txt, () => {
    txt.select();
  });

  return Submenu({
    children: [
      txt,
      ToolbarButton(editor, { html: 'Link', run: link }),
      ToolbarButton(editor, { html: 'Unlink', run: unlink }),
    ],
    editor,
  });
}

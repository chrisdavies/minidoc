import * as Rng from '../range';
import * as Dom from '../dom';
import { h } from '../dom';
import { onMount } from '../disposable';
import { ToolbarButton, Submenu } from '../toolbar';
import { MinidocToolbarEditor } from '../types';

function highlight(range: Range) {
  const [inlinable] = Rng.inlinableRanges(range);
  if (!inlinable || inlinable.collapsed) {
    return;
  }
  const highlighter = h(
    'mini-highlighter',
    { style: 'background-color: highlight;' },
    inlinable.extractContents(),
  );
  inlinable.insertNode(highlighter);
  Rng.$copy(range, inlinable);
  return highlighter;
}

function restoreSelection(range?: Range) {
  return range && Rng.setCurrentSelection(range);
}

export function LinkMenu(editor: MinidocToolbarEditor) {
  const range = Rng.currentRange();
  if (!range) {
    return;
  }
  const a = Dom.closest('a', Rng.toNode(range));
  const highlighter = highlight(range);
  let href = Dom.attr('href', a) || '';
  const hide = () => {
    try {
      const setFocus = !editor.root.contains(document.activeElement);
      const newRange = Dom.replaceSelfWithChildren(highlighter);
      setFocus && (newRange || range) && Rng.setCurrentSelection(newRange || range);
    } finally {
      editor.toolbar.setMenu(undefined);
    }
  };
  const unlink = () => {
    restoreSelection(Dom.replaceSelfWithChildren(a));
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
    Rng.setCurrentSelection(range);
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
    return [hide, Dom.on(editor.root, 'focus', hide)];
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

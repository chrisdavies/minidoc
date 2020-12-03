import * as Rng from '../range';
import * as Dom from '../dom';
import { h } from '../dom';
import { onMount } from '../disposable';
import { ToolbarButton, Submenu } from '../toolbar';

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
  range.setStart(inlinable.startContainer, inlinable.startOffset);
  range.setEnd(inlinable.endContainer, inlinable.endOffset);
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
    editor.toolbar.setMenu(undefined);
    Dom.replaceSelfWithChildren(highlighter);
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
    return Dom.on(editor.root, 'focus', () => {
      hide();
    });
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

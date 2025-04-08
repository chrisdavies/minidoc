import * as Rng from '../range';
import * as Dom from '../dom';
import { h } from '../dom';
import { onMount } from '../disposable';
import { ToolbarButton, Submenu, MinidocToolbarEditor } from '../toolbar';
import { getBehavior } from '..';

export interface LinkBehavior {
  getHref(): string;
  setHref(href: string): void;
}

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

function getLinkBehavior(range: Range): LinkBehavior {
  const currentNode = Rng.toNode(range);
  const leaf = Dom.findLeaf(currentNode);
  const behavior = getBehavior<LinkBehavior>(leaf);

  if (behavior && !!behavior.getHref && !!behavior.setHref) {
    return behavior as LinkBehavior;
  }

  const a = Dom.closest('a', currentNode);
  return {
    getHref() {
      return Dom.attr('href', a) || '';
    },
    setHref(href) {
      if (!href) {
        restoreSelection(Dom.replaceSelfWithChildren(a));
      } else if (a) {
        Dom.assignAttrs({ href }, a);
      } else if (Dom.isCard(leaf)) {
        Dom.insertAfter(h('p', h('a', { href }, href)), leaf);
      } else {
        range.insertNode(h('a', { href }, range.collapsed ? href : range.extractContents()));
      }
    },
  };
}

export function LinkMenu(editor: MinidocToolbarEditor) {
  const range = Rng.currentRange();
  if (!range) {
    return;
  }
  const behavior = getLinkBehavior(range);
  const highlighter = highlight(range);
  let href = behavior.getHref();

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
    behavior.setHref('');
    hide();
  };

  const link = () => {
    if (!href) {
      return unlink();
    }

    const url = /^(https?:\/\/)|^(\/)|^(mailto:)/.test(href) ? href : `//${href}`;
    behavior.setHref(url);
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

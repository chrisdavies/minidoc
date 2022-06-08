/**
 * This plugin handles the editor behavior for li / ol / ul elements.
 */

import * as Rng from '../range';
import * as Dom from '../dom';
import { h } from '../dom';
import { EditorMiddleware, MinidocBase } from '../types';
import { Changeable } from '../undo-redo';
import { toggleList } from './toggle-list';
import { InlineTogglable } from '../inline-toggle';
import { OnSequenceable } from '../on-sequence';

export interface ListTogglable {
  toggleList(tagName: string): void;
}

const convertNodeTo = (tagName: string) => (node: Node) => {
  const leaf = Dom.findLeaf(node);
  const li = h('li', h('br'));
  leaf?.replaceWith(h(tagName, li));
  Rng.setCaretAtStart(li);
};

function convertListItemToLeaf(li: Element, range: Range) {
  // We're in an empty li, and the user is attempting to break out of it
  const newLeaf = h('p', li.childNodes);
  const [a, b] = Rng.$splitContainer(Dom.findLeaf, range);
  a && Dom.insertAfter(newLeaf, a);
  // Since the li is empty we need to remove it
  Dom.remove(li);
  // We also need to remove the first li from b, since it is
  // a clone of our empty li.
  b && Dom.remove(b.querySelector('li') || undefined);
  // And if the original li had any nested lists, we need to move them back to the parent...
  Array.from(newLeaf.querySelectorAll('ul,ol')).forEach((l) => {
    l.remove();
    b && b.prepend(...Array.from(l.children));
  });
  a && Dom.isEmpty(a) && Dom.remove(a);
  b && Dom.isEmpty(b) && Dom.remove(b);
  Rng.setCaretAtStart(newLeaf);
}

function indent(li: Element) {
  const previousLi = li.previousElementSibling;
  // Can't indent the first li...
  if (!previousLi) {
    return;
  }
  const parent = Dom.closest('ol,ul', li)!;
  const newList = previousLi.querySelector('ol,ul') || h(parent.tagName);
  previousLi.appendChild(newList);
  newList.appendChild(li);
  Rng.setCaretAtStart(li);
}

function outdent(li: Element) {
  const parent = Dom.closest('ol,ul', li)!;
  const grandparent = Dom.closest('ol,ul', parent.parentElement!);

  // We're unindenting out of our list container.
  if (!grandparent) {
    convertListItemToLeaf(li, Rng.currentRange()!);
    return;
  }

  grandparent.insertBefore(li, parent.parentElement?.nextElementSibling!);
  Rng.setCaretAtStart(li);
  if (Dom.isEmpty(parent)) {
    Dom.remove(parent);
  }
}

const handlers: {
  [key: string]: (e: KeyboardEvent, ctx: MinidocBase & InlineTogglable) => void;
} = {
  Enter(e, ctx) {
    if (!ctx.isActive('LI')) {
      return;
    }
    e.preventDefault();
    const range = Rng.currentRange();
    if (!range) {
      return;
    }
    range.deleteContents();
    const li = Dom.closest('li', Rng.toNode(range)!)!;
    if (!li) {
      // We deleted a selection which started in an li, but ended in
      // a non-list (paragraph or whatever), so there's nothing left
      // to do.
      return;
    }
    if (!Dom.isEmpty(li)) {
      // We're in a non-empty li. In this scenario, we split it at the caret.
      const [a, b] = Rng.$splitContainer(Dom.closest('li'), range);
      a && Dom.$makeEditable(a);
      b && Dom.$makeEditable(b);
      b && Rng.setCaretAtStart(b);
      return;
    }
    // We're in an empty li, and the user is attempting to break out of it
    convertListItemToLeaf(li, range);
  },
  Backspace(e, ctx) {
    if (!ctx.isActive('LI')) {
      return;
    }
    const range = Rng.currentRange()!;
    // If the range has a selection, then this should be a normal delete,
    // we can let the default handler take this.
    if (!range.collapsed) {
      return;
    }
    const node = Rng.toNode(range)!;
    const li = Dom.closest('li', node)!;
    // If we're in a leaf li, and it's the very first li, convert it to a p
    if (
      !Dom.closest('li', li.parentElement!) &&
      Rng.isAtStartOf(li, range) &&
      !li.previousElementSibling
    ) {
      e.preventDefault();
      convertListItemToLeaf(li, range);
    }
  },
  Tab(e, ctx) {
    if (!ctx.isActive('LI')) {
      return;
    }
    e.preventDefault();
    // We don't currently support tabbing list selections
    Rng.currentRange()!.collapse(true);
    if (e.shiftKey) {
      outdent(Dom.closest('li', Rng.currentNode()!)!);
    } else {
      indent(Dom.closest('li', Rng.currentNode()!)!);
    }
  },
};

export const listMixin: EditorMiddleware<ListTogglable> = (next, editor) => {
  const result = editor as MinidocBase &
    ListTogglable &
    Changeable &
    InlineTogglable &
    OnSequenceable;
  result.toggleList = (tagName) => {
    const range = Rng.currentRange();
    range &&
      result.captureChange(() => {
        const isCollapsed = range.collapsed;
        const newRange = toggleList(tagName, range);
        if (isCollapsed) {
          newRange.collapse(true);
        }
        Rng.setCurrentSelection(newRange);
      });
  };

  result.onSequence('* ', convertNodeTo('ul'));
  result.onSequence('- ', convertNodeTo('ul'));
  result.onSequence('1.', convertNodeTo('ol'));

  Dom.on(editor.root, 'keydown', (e) => {
    !e.defaultPrevented && handlers[e.code]?.(e, result);
  });
  return next(result);
};

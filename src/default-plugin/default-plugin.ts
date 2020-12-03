/**
 * This is the core (and lowest-priority) behavior for the editor.
 * Other plugins take precedence over this one.
 */

import * as Rng from '../range';
import * as Dom from '../dom';
import { h } from '../dom';
import { toggleInline } from './toggle-inline';
import '../types';

function defaultDelete(direction: 'left' | 'right') {
  const range = Rng.currentRange();
  if (!range) {
    return;
  }
  Rng.$deleteAndMergeContents((range.collapsed && Rng.extendSelection(direction)) || range);
}

function ctrlToggle(tagName: string, e: KeyboardEvent, editor: MinidocCoreEditor) {
  const isCtrl = e.ctrlKey || e.metaKey;
  if (!isCtrl) {
    return;
  }
  const range = Rng.currentRange()!;
  if (range.collapsed) {
    editor.emit('caretchange');
    return;
  }
  e.preventDefault();
  toggleInline(tagName, range);
}

const handlers: { [key: string]: MinidocKeyboardHandler } = {
  Enter(e) {
    e.preventDefault();
    const range = Rng.currentRange();
    if (!range) {
      return;
    }
    range.deleteContents();
    const [a, b] = Rng.$splitContainer(Dom.findLeaf, range);
    Dom.$makeEditable(a);
    Dom.$makeEditable(b);
    Rng.setCaretAtStart(b);
  },
  Backspace(e, ctx) {
    e.preventDefault();
    const range = Rng.currentRange()!;
    if (range.collapsed) {
      const currentLeaf = Dom.findLeaf(Rng.toNode(range)!);
      // If we're in a non-paragraph, and we're backspacing at the start of it,
      // we will convert it to a paragraph.
      if (currentLeaf && currentLeaf.tagName !== 'P' && Rng.isAtStartOf(currentLeaf, range)) {
        const newLeaf = h('p', currentLeaf.childNodes);
        currentLeaf.parentElement?.insertBefore(newLeaf, currentLeaf);
        Dom.remove(currentLeaf);
        Rng.setCaretAtStart(newLeaf);
        return;
      }
    }
    defaultDelete('left');
    Dom.$makeEditable(ctx.root);
  },
  Delete(e, ctx) {
    e.preventDefault();
    defaultDelete('left');
    Dom.$makeEditable(ctx.root);
  },
  KeyB(e, ctx) {
    ctrlToggle('strong', e, ctx);
  },
  KeyI(e, ctx) {
    ctrlToggle('em', e, ctx);
  },
};

export const defaultPlugin: MinidocPlugin = {
  name: 'default',
  onKeydown(e, ctx) {
    handlers[e.code]?.(e, ctx);
  },
};

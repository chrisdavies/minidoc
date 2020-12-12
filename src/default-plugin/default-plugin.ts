/**
 * This is the core (and lowest-priority) behavior for the editor.
 * Other plugins take precedence over this one.
 */

import * as Rng from '../range';
import * as Dom from '../dom';
import { h } from '../dom';
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
  e.preventDefault();
  editor.toggleInline(tagName);
}

function deleteSelection(range: Range, editor: MinidocCoreEditor) {
  // In this scenario, the browser does the right thing, so let it go.
  if (
    range.collapsed &&
    Dom.isText(range.startContainer) &&
    range.startOffset < range.startContainer.length
  ) {
    return;
  }
  defaultDelete('right');
  document.getSelection()?.collapseToStart();
  Dom.$makeEditable(editor.root);
  return true;
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
    a && Dom.$makeEditable(a);
    if (b && Dom.isEmpty(b)) {
      const el = h('p', b.childNodes);
      b.replaceWith(el);
      Dom.$makeEditable(el);
      Rng.setCaretAtStart(el);
    } else {
      b && Rng.setCaretAtStart(b);
    }
  },
  Backspace(e, ctx) {
    const range = Rng.currentRange()!;
    // In this scenario, the browser does the right thing, so let it go.
    if (range.collapsed && range.startOffset > 0 && Dom.isText(range.startContainer)) {
      return;
    }
    e.preventDefault();
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
    document.getSelection()?.collapseToStart();
    Dom.$makeEditable(ctx.root);
  },
  Delete(e, ctx) {
    const range = Rng.currentRange()!;
    if (deleteSelection(range, ctx)) {
      e.preventDefault();
    }
  },
  KeyB(e, ctx) {
    ctrlToggle('strong', e, ctx);
  },
  KeyI(e, ctx) {
    ctrlToggle('em', e, ctx);
  },
  KeyZ(e, ctx) {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      e.shiftKey ? ctx.redo() : ctx.undo();
    }
  },
  KeyY(e, ctx) {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      ctx.redo();
    }
  },
};

export const defaultPlugin: MinidocPlugin = (editor) => {
  Dom.on(editor.root, 'keydown', (e) => {
    e.stopPropagation();
    if (e.defaultPrevented) {
      return;
    }
    const handler = handlers[e.code];
    if (handler) {
      handler(e, editor);
    } else if (!e.metaKey && !e.ctrlKey && e.key.length === 1) {
      // If the user is typing into a selected range, we need
      // to do a clean delete on the range, and then allow the
      // input to continue. The e.key.length === 1 above is a hacky
      // way of checking to see if the user is typing.
      const range = Rng.currentRange()!;
      if (!range.collapsed) {
        deleteSelection(range, editor);
      }
    }
  });

  Dom.on(editor.root, 'keyup', () => editor.undoHistory.onChange());
  return editor;
};

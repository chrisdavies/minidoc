/**
 * This module contains the logic for preventing the contenteditable from
 * injecting garbage HTML on normal edit operations.
 */
import * as Dom from '../dom';
import * as Rng from '../range';
import { EditorMiddleware, MinidocBase } from '../types';

function deleteRange(range: Range, direction: 'left' | 'right') {
  const result = range.collapsed ? Rng.extendSelection(direction)! : range;
  Rng.$deleteAndMergeContents(result);
  Rng.setCurrentSelection(result);
}

function onDelete(e: Event) {
  const range = Rng.currentRange();
  if (
    !range ||
    (range.collapsed &&
      Dom.isText(range.startContainer) &&
      range.startOffset < range.startContainer.length)
  ) {
    return;
  }

  e.preventDefault();
  deleteRange(range, 'right');
}

function onBackspace(e: Event) {
  const range = Rng.currentRange();
  // In this scenario, the browser does the right thing, so let it go.
  if (!range || (range.collapsed && range.startOffset > 0 && Dom.isText(range.startContainer))) {
    return;
  }

  e.preventDefault();
  deleteRange(range, 'left');
}

function onInput(e: KeyboardEvent) {
  const sel = document.getSelection();
  if (!sel || sel.isCollapsed) {
    return;
  }
  const isTyping = !e.ctrlKey && !e.metaKey && e.key.length === 1;
  if (!isTyping) {
    return;
  }
  deleteRange(sel.getRangeAt(0), 'right');
}

function onEnter(e: KeyboardEvent) {
  const range = Rng.currentRange();
  if (!range || range.collapsed) {
    return;
  }
  e.preventDefault();
  const [, tail] = Rng.$splitContainer(Dom.findLeaf, range);
  tail && Rng.setCaretAtStart(tail);
}

export const stylePrevention: EditorMiddleware = (next, editor: MinidocBase) => {
  const result = next(editor);
  Dom.on(result.root, 'keydown', (e) => {
    if (e.defaultPrevented) {
      return;
    }
    if (e.code === 'Delete') {
      onDelete(e);
    } else if (e.code === 'Backspace') {
      onBackspace(e);
    } else if (e.key === 'Enter') {
      onEnter(e);
    } else {
      // The user is typing, and we need to make sure we delete any
      // selection cleanly, or the editor will bork up the markup.
      onInput(e);
    }
  });
  return result;
};

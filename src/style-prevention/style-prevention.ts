/**
 * This module contains the logic for preventing the contenteditable from
 * injecting garbage HTML on normal edit operations.
 */
import * as Dom from '../dom';
import * as Rng from '../range';
import { EditorMiddleware, MinidocBase } from '../types';

/**
 * If we're deleting / backspacing into an immutable node (a),
 * we need to hand behavioral control over to the immutable
 * node's code, and we'll allow it to handle things. If the
 * node we're leaving (b) is empty, we'll delete it.
 */
function deleteIntoImmutable(a: Node, b: Node) {
  if (!Dom.isImmutable(a)) {
    return;
  }
  if (Dom.isEmpty(b)) {
    Dom.remove(b);
  }
  Rng.setCaretAtStart(a);
  return true;
}

function deleteRange(originalRange: Range, direction: 'left' | 'right') {
  let range = originalRange;
  if (range.collapsed) {
    range = Rng.extendSelection(direction)!;
    const [a, b] = Rng.findLeafs(range);
    if (deleteIntoImmutable(a, b) || deleteIntoImmutable(b, a)) {
      return;
    }
  }

  Rng.$deleteAndMergeContents(range);
  Rng.setCurrentSelection(range);
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
  if (!sel) {
    return;
  }
  const isTyping = !e.ctrlKey && !e.metaKey && e.key.length === 1;
  if (!isTyping) {
    return;
  }
  const range = sel.getRangeAt(0);
  if (!sel.isCollapsed) {
    deleteRange(range, 'right');
  }
  // Detect if we're attempting to type into an invalid leaf (a
  // text node at the root of the editor), and if so, convert it
  // to a paragraph.
  if (Dom.isRoot(range.startContainer)) {
    // Rng.setCaretAtStart(Rng.toNode(range));
    const leaf = Dom.newLeaf();
    range.insertNode(leaf);
    Rng.setCaretAtStart(leaf);
  }
}

function onEnter(e: KeyboardEvent) {
  const range = Rng.currentRange();
  if (!range) {
    return;
  }
  e.preventDefault();
  const [head, tail] = Rng.$splitContainer(Dom.findLeaf, range);
  if (head) {
    Dom.$makeEditable(head);
  }
  if (tail) {
    const leaf = Dom.isEmpty(tail) ? Dom.newLeaf() : tail;
    tail.replaceWith(leaf);
    Rng.setCaretAtStart(Dom.$makeEditable(leaf));
  }
}

export const stylePrevention: EditorMiddleware = (next, editor: MinidocBase) => {
  const result = next(editor);
  Dom.on(result.root, 'keydown', (e) => {
    // Do not insert a new line when pressing cmd+enter
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      return;
    }
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

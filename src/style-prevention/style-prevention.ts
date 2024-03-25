/**
 * This module contains the logic for preventing the contenteditable from
 * injecting garbage HTML on normal edit operations.
 */
import * as Dom from '../dom';
import { inferMiddleware } from '../mixins';
import * as Rng from '../range';
import { MinidocBase } from '../types';

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

  // When we're at the end of an element, if we're deleting into an HR, we have
  // to handle this specially, thanks to Chrome doing the wrong thing.
  if (range.collapsed && range.startOffset === (range.startContainer as Text).length) {
    const next =
      range.startContainer.nextSibling || range.startContainer.parentElement?.nextSibling;
    if (next instanceof HTMLHRElement) {
      next.remove();
      return;
    }
  }

  deleteRange(range, 'right');
}

function onBackspace(e: Event) {
  const range = Rng.currentRange();
  // In this scenario, the browser does the right thing, so let it go.
  if (!range || (range.collapsed && range.startOffset > 0 && Dom.isText(range.startContainer))) {
    return;
  }

  e.preventDefault();

  // When we're at the end of an element, if we're deleting into an HR, we have
  // to handle this specially, thanks to Chrome doing the wrong thing.
  if (range.collapsed && range.startOffset === 0) {
    const prev =
      range.startContainer.previousSibling || range.startContainer.parentElement?.previousSibling;
    if (prev instanceof HTMLHRElement) {
      prev.remove();
      return;
    }
  }

  deleteRange(range, 'left');
}

function onInput() {
  const sel = document.getSelection();
  if (!sel) {
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

function onEnter(e: InputEvent) {
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
    const leaf = Dom.isEmpty(tail)
      ? Dom.newLeaf(e.inputType === 'insertLineBreak' ? 'h3' : 'p')
      : tail;
    tail.replaceWith(leaf);
    Rng.setCaretAtStart(Dom.$makeEditable(leaf));
  }
}

export const stylePrevention = inferMiddleware((next, editor: MinidocBase) => {
  const result = next(editor);

  Dom.on(result.root, 'beforeinput', (e) => {
    if (e.inputType === 'insertParagraph' || e.inputType === 'insertLineBreak') {
      e.preventDefault();
      onEnter(e);
    } else if (e.inputType === 'deleteContentForward') {
      onDelete(e);
    } else if (e.inputType.startsWith('delete')) {
      onBackspace(e);
    } else if (e.inputType === 'insertText' || e.inputType === 'inertReplacementText') {
      onInput();
    }
  });

  return result;
});

import * as Dom from '../dom';

export function toNode(range: Range): Node {
  return range.startContainer.childNodes[range.startOffset] || range.startContainer;
}

/**
 * Get the end of the range.
 */
export function toEndNode(range: Range) {
  // For text nodes, endOffset is the number of characters from the start of the text node to the boundary point of the range.
  // For other Node types, the endOffset is the number of child nodes between the start of the endContainer and the boundary point of the Range.
  return range.collapsed
    ? toNode(range)
    : range.endContainer.childNodes[range.endOffset - 1] || range.endContainer;
}

/**
 * Get the currently selected range.
 */
export function currentRange(): Range | undefined {
  return document.getSelection()?.getRangeAt(0);
}

/**
 * Get the currently selected node.
 */
export function currentNode(): Node | undefined {
  const range = currentRange();
  if (range) {
    return toNode(range);
  }
}

/**
 * Extend the current selection left or right one character.
 */
export function extendSelection(direction: 'left' | 'right'): Range | undefined {
  const sel = document.getSelection();
  (sel as any).modify('extend', direction, 'character');
  return sel?.getRangeAt(0);
}

/**
 * Create an empty range.
 */
export const createRange = () => document.createRange();

/**
 * Overwrite the current selection with the specified range.
 */
export function setCurrentSelection(range: Range): Range {
  const sel = document.getSelection()!;
  sel.removeAllRanges();
  sel.addRange(range);
  return range;
}

/**
 * Find the leafs that the range touches.
 */
export function findLeafs(range: Range) {
  return Dom.findLeafs(toNode(range), toEndNode(range));
}

/**
 * Delete the specified range and merge the node contents.
 */
export function $deleteAndMergeContents(range: Range) {
  if (range.collapsed) {
    return;
  }
  const startNode = toNode(range);
  const endNode = toEndNode(range);
  const startEl = Dom.closestBlock(startNode)!;
  const endEl = Dom.closestBlock(endNode)!;
  const endLeaf = Dom.findLeaf(endEl)!;
  const clone = range.cloneRange();
  range.collapse(true);
  const content = clone.extractContents();
  // If the start block and end block are the same, then we're deleting
  // inline nodes, and the browser seems to handle this just fine. So,
  // we only need to special-case the deletion across block elements.
  if (startEl !== endEl) {
    // If we're moving an li out of a list, and it has a sublist, we need to
    // unnest the sublist.
    if (endEl.tagName === 'LI' && startEl.tagName !== 'LI') {
      const nestedList = endEl.querySelector('ol,ul');
      nestedList && Dom.mergeLists(nestedList, endEl.parentElement!, endEl);
    }
    Array.from(endEl.childNodes).forEach((n) => startEl.appendChild(n));
    // If there is a nested list in the start el, it needs to be
    // moved to the end.
    if (startEl.tagName === 'LI') {
      const nestedList = startEl.querySelector('ol,ul');
      nestedList?.remove();
      nestedList && startEl.appendChild(nestedList);
    }
    Dom.remove(endEl);
  }
  startEl.normalize();
  if (Dom.isEmpty(endLeaf)) {
    Dom.remove(endLeaf);
  } else if (endLeaf.matches('ol,ul') && endLeaf.previousElementSibling?.matches('ol,ul')) {
    // The deletion resulted in two sibling lists, so we need to merge them.
    Dom.mergeLists(endLeaf, endLeaf.previousElementSibling!);
  }
  return content;
}

/**
 * Set the range end after the specified node. This produces a new range.
 */
export function setEndAfter(node: Node, range: Range): Range {
  const result = range.cloneRange();
  result.setEndAfter(node);
  return result;
}

/**
 * Determine whether or not the specified range is at the very start
 * of the specified node.
 */
export function isAtStartOf(node: Node, range: Range): boolean {
  const { startContainer, startOffset } = range;
  if (startOffset) {
    return false;
  }
  let curr: Node | null = startContainer;
  while (true) {
    if (curr === node) {
      return true;
    }
    if (!curr || curr.previousSibling) {
      return false;
    }
    curr = curr.parentNode;
  }
}

/**
 * Split the container into two at the range.
 */
export function $splitContainer(
  findContainer: (node: Node) => Element | undefined,
  range: Range,
): [Element, Element] {
  const container = findContainer(toNode(range))!;
  const tailRange = setEndAfter(container, range);
  const tailEl = tailRange.cloneContents().children[0];
  container.parentElement?.insertBefore(tailEl, container.nextSibling);
  tailRange.deleteContents();
  range.setStartBefore(tailEl);
  return [container, tailEl];
}

/**
 * Set the caret to be at the very first position within node.
 */
export function setCaretAtStart(node: Node): Range {
  const range = createRange();
  range.setStart(node, 0);
  return setCurrentSelection(range);
}

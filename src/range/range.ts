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

function closestBlock(node: Node): Element {
  const blockSelector = 'div,p,li,ul,ol,section,footer,header,nav,table';
  const el = node instanceof Element ? node : node.parentElement!;
  return el.closest(blockSelector)!;
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
  const startEl = closestBlock(startNode);
  const endEl = closestBlock(endNode);
  const clone = range.cloneRange();
  range.collapse(true);
  clone.deleteContents();
  const content = clone.extractContents();
  if (startEl !== endEl) {
    Array.from(endEl.childNodes).forEach((n) => startEl.appendChild(n));
    endEl.remove();
  }
  startEl.normalize();
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
 * Split the container into two at the range.
 */
export function $splitContainer(
  findContainer: (node: Node) => Element | undefined,
  range: Range,
): [Element, Element] {
  const container = findContainer(toNode(range))!;
  const tailRange = setEndAfter(container, range);
  const tailEl = tailRange.cloneContents().children[0];
  container.parentElement?.insertBefore(tailEl, container.nextElementSibling);
  tailRange.deleteContents();
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

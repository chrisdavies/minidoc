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
  const range = document.getSelection()?.getRangeAt(0);
  if (Dom.isInEditor(range?.startContainer)) {
    return range;
  }
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
  if (Dom.isEmpty(startEl, true)) {
    Dom.$makeEditable(startEl);
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
 * Create a new range that surrounds the specified nodes.
 */
export function fromNodes(nodes: Node[]) {
  const range = createRange();
  range.selectNodeContents(nodes[nodes.length - 1]);
  range.setStart(nodes[0], 0);
  return range;
}

/**
 * Modify toRange to be a copy of fromRange.
 */
export function $copy(toRange: Range, fromRange: Range) {
  toRange.setStart(fromRange.startContainer, fromRange.startOffset);
  toRange.setEnd(fromRange.endContainer, fromRange.endOffset);
  return toRange;
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

/**
 * Wraps the DOM TreeWalker, returning a walker that starts at startNode
 * and ends at endNode.
 */
function rangeWalker(container: Node, startNode: Node, endNode: Node) {
  let ended = false;
  const treeWalker = document.createTreeWalker(
    container,
    NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
  );
  let currentNode: Node | undefined = treeWalker.currentNode;
  const walker = {
    get currentNode() {
      return currentNode;
    },
    nextNode() {
      if (ended) {
        currentNode = undefined;
        return;
      }
      currentNode = treeWalker.nextNode() || undefined;
      ended = ended || currentNode === endNode || !currentNode;
      return currentNode;
    },
  };

  // Advance to the range's start node. There's a weird edgecase where the
  // startNode may show up *after* the end node. This happens when the startNode
  // is a child of the end node. The caret is after the start node, but at the end
  // or outside of the end node which is startNode's parent.
  while (walker.currentNode && walker.currentNode !== startNode) {
    walker.nextNode();
  }

  if (ended) {
    currentNode = startNode;
  }

  return walker;
}

/**
 * Creates an array of ranges from the specified range. Each range in the result
 * is capable of being wrapped in an inline tag.
 */
export function inlinableRanges(range: Range): Range[] {
  if (range.collapsed) {
    return [];
  }

  const startNode = toNode(range);
  const endNode = toEndNode(range);
  const result: Range[] = [];
  const walker = rangeWalker(range.commonAncestorContainer, startNode, endNode);

  // Move to the next inlinable node
  function findStart() {
    while (walker.currentNode && Dom.isBlock(walker.currentNode)) {
      walker.nextNode();
    }
    return walker.currentNode;
  }

  function findEnd() {
    let node = walker.currentNode;
    while (walker.currentNode && !Dom.isBlock(walker.currentNode)) {
      node = walker.currentNode;
      walker.nextNode();
    }
    return node;
  }

  while (walker.currentNode) {
    const start = findStart();
    const end = findEnd();
    if (!end || !start) {
      break;
    }
    const inlineRange = createRange();
    if (start === startNode) {
      inlineRange.setStart(range.startContainer, range.startOffset);
    } else {
      inlineRange.setStartBefore(start);
    }
    if (end === endNode) {
      inlineRange.setEnd(range.endContainer, range.endOffset);
    } else {
      inlineRange.setEndAfter(end);
    }
    result.push(inlineRange);
  }

  return result;
}

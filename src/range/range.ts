import * as Dom from '../dom';
import { last } from '../util';

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
  const endEl = Dom.closestBlock(endNode);
  const endLeaf = Dom.findLeaf(endNode)!;
  const clone = range.cloneRange();
  range.collapse(true);
  const content = clone.extractContents();
  // If the start block and end block are the same, then we're deleting
  // inline nodes, and the browser seems to handle this just fine. So,
  // we only need to special-case the deletion across block elements.
  if (startEl !== endEl) {
    // If we're moving an li out of a list, and it has a sublist, we need to
    // unnest the sublist.
    if (endEl && endEl.tagName === 'LI' && startEl.tagName !== 'LI') {
      const nestedList = endEl.querySelector('ol,ul');
      nestedList && Dom.mergeLists(nestedList, endEl.parentElement!, endEl);
    }
    endEl && Array.from(endEl.childNodes).forEach((n) => startEl.appendChild(n));
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
export function fromNodes(nodes: Node[] | HTMLCollection) {
  const range = createRange();
  range.selectNodeContents(last(nodes)!);
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
  const { startOffset } = range;
  let curr: Node | null = toNode(range);
  // This happens when we have something like <p><br></p>
  if (Dom.isEmpty(curr, true) && curr.previousSibling && Dom.isEmpty(curr.previousSibling, true)) {
    curr = curr.previousSibling;
  } else if (startOffset) {
    return false;
  }

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
 * Determine whether or not the specified range is at the very end
 * of the specified node.
 */
export function isAtEndOf(node: Node, range: Range): boolean {
  const { startOffset } = range;
  let curr: Node | null = toNode(range);
  // This happens when we have something like <p><br></p>
  if (Dom.isEmpty(curr, true) && curr.nextSibling && Dom.isEmpty(curr.nextSibling, true)) {
    curr = curr.nextSibling;
  } else if (startOffset && Dom.isText(curr) && curr.length > startOffset) {
    return false;
  }

  while (true) {
    if (curr === node) {
      return true;
    }
    if (!curr || curr.nextSibling) {
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
): [Element | undefined, Element | undefined] {
  const startLeaf = Dom.findLeaf(toNode(range));
  const endLeaf = Dom.findLeaf(toEndNode(range));
  if (startLeaf && Dom.isImmutable(startLeaf)) {
    const l = Dom.newLeaf();
    startLeaf.replaceWith(l);
    range.setStart(l, 0);
  }
  if (endLeaf?.isConnected && Dom.isImmutable(endLeaf)) {
    const l = Dom.newLeaf();
    endLeaf.replaceWith(l);
    range.setEnd(l, 0);
  }

  range.deleteContents();
  const container = findContainer(toNode(range))!;
  const tailRange = setEndAfter(container, range);
  const tailEl = tailRange.cloneContents().children[0];
  container.parentElement?.insertBefore(tailEl, container.nextSibling);
  tailRange.deleteContents();
  range.setStartBefore(tailEl);
  return [container.isConnected ? container : undefined, tailEl];
}

/**
 * Split the container into two at the range, and insert the
 * specified content between the two halves, merging the content
 * intelligently.
 */
export function $splitAndInsert(
  findContainer: (node: Node) => Element | undefined,
  range: Range,
  content: DocumentFragment,
): Range {
  const firstNode = content.firstChild;
  const lastNode = content.lastChild;

  if (!lastNode) {
    return range;
  }

  const [a, b] = $splitContainer(findContainer, range);

  if (a) {
    Dom.insertAfter(content, a);
  } else if (b) {
    b.parentNode!.insertBefore(content, b);
  } else {
    range.insertNode(content);
  }

  const result = fromNodes([lastNode]);

  a && Dom.isEmpty(a, true) && a.remove();
  b && Dom.isEmpty(b, true) && b.remove();

  // Possibly merge the first element into the first slice of the sandwich
  const mergeA =
    a?.isConnected && !Dom.isCard(firstNode) && !Dom.isList(firstNode) && !Dom.isList(a);
  if (mergeA && Dom.isElement(firstNode)) {
    firstNode.remove();
    a!.append(Dom.toFragment(firstNode.childNodes));
  }

  // Possibly merge the last element into the last slice of the sandwich
  if (
    b?.isConnected &&
    Dom.isElement(lastNode) &&
    (lastNode !== firstNode || !mergeA) &&
    !Dom.isCard(lastNode) &&
    !Dom.isList(lastNode) &&
    !Dom.isList(b)
  ) {
    b.remove();
    lastNode.append(Dom.toFragment(b.childNodes));
  }

  return result;
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
  const walker = document.createTreeWalker(
    range.commonAncestorContainer,
    NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
  );

  let started = false;
  let ended = false;
  let currentNode: Node | undefined = walker.currentNode || undefined;

  function moveNext() {
    let node: Node | undefined = walker.currentNode;
    while (!ended) {
      if (node === startNode) {
        started = true;
      }
      if (!node || node === endNode) {
        ended = true;
      }
      if (!Dom.isImmutable(node)) {
        walker.nextNode();
        return node;
      }
      if (node && !started && node.contains(startNode)) {
        started = true;
      }
      if (node && !ended && node.contains(endNode)) {
        ended = true;
      }
      if (ended) {
        return;
      }
      node = walker.nextSibling() || undefined;
    }
  }

  // Move to the next inlinable node
  function findNextStart() {
    while (currentNode && Dom.isBlock(currentNode)) {
      currentNode = moveNext();
    }
    return currentNode;
  }

  function findNextEnd() {
    let node = currentNode;
    while (currentNode && !Dom.isBlock(currentNode)) {
      node = currentNode;
      currentNode = moveNext();
    }
    return node;
  }

  // Advance to the range's start node. There's a weird edgecase where the
  // startNode may show up *after* the end node. This happens when the startNode
  // is a child of the end node. The caret is after the start node, but at the end
  // or outside of the end node which is startNode's parent.
  while (currentNode && !started) {
    currentNode = moveNext();
  }

  // Iterate through the nodes until we come to the end node.
  while (currentNode) {
    const start = findNextStart();
    const end = findNextEnd();
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

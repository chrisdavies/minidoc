/**
 * Find the normalized previous node used for computing the
 * node's offset within its parent. If node is a text node,
 * normalization will merge it with all other sibling text
 * nodes, so we will return the previous element instead.
 * Otherwise, we'll return the previous sibling, skipping
 * any empty text nodes (which normalization will remove).
 * All of this work is to avoid a selection bug in Safari
 * with normalization. :/
 */
function normalizedPrev(node: Node) {
  if (node instanceof Text) {
    return node.previousElementSibling;
  }
  let prev = node.previousSibling;
  while (prev && prev instanceof Text && !prev.length) {
    prev = prev.previousSibling;
  }
  return prev;
}

/**
 * Find the position of node in its parent's childNodes collection.
 * This is not a simple indexOf, since we need to compute the index
 * as if the parent node has been normalized via `node.parentNode.normalize()`
 * however, Safari loses selection when normalize is called, so we
 * can't simply call normalize and call it a day.
 * @param node
 */
function normalizedIndex(node: Node) {
  if (!node) {
    return 0;
  }
  let index = 0;
  let prev: Node | null = normalizedPrev(node);
  while (prev) {
    ++index;
    prev = normalizedPrev(prev);
  }
  return index;
}

/**
 * Given a startNode and a startOffset, compute the normalized
 * offset. This is similar to normalizedIndex, but it special-cases
 * text nodes.
 * @param node
 * @param offset
 */
function normalizedOffset(node: Node, offset: number) {
  if (node instanceof Element) {
    const child = node.childNodes[offset] || node.lastChild;
    return child ? normalizedIndex(child) + 1 : offset;
  }
  let iter = node.previousSibling;
  while (iter instanceof Text) {
    offset += iter.length;
    iter = iter.previousSibling;
  }
  return offset;
}

function getNodePath(node: Node, offset: number, rootEl: Element): DetachedPosition {
  // Ideally, here, we'd call node.normalize(), which would give us a safe
  // path, but unfortunately, Safari loses the selection when you normalize,
  // so we have to compute the path as if normalized. What that means is, if the
  // node is an element, we can use .children[] which is already in normalized form.
  // But if the node is a text node, we need to compute its normalized offset.

  const path = [];

  let iter: Node | null = node;
  while (iter && iter !== rootEl) {
    const index = normalizedIndex(iter);
    index >= 0 && path.push(index);
    iter = iter.parentElement;
  }

  return { path: path.reverse(), offset: normalizedOffset(node, offset) };
}

/**
 * Find the descendent of node which is referred to by the nodePath.
 */
function resolveNodePath(pos: DetachedPosition | undefined, node: Node) {
  if (!pos || !node) {
    return;
  }
  const { offset, path } = pos;
  node.normalize();
  for (let i of path) {
    node = node && node.childNodes[i];
  }
  return { node, offset };
}

export function emptyDetachedRange(): DetachedRange {
  return { start: { offset: -1, path: [] } };
}

/**
 * Detach the range from the specified element. The resulting object can then be
 * attached to a different root via the attachTo function.
 */
export function detachFrom(range: Range | undefined, rootEl: Element): DetachedRange | undefined {
  // { path, offset, textOffset }, with the textOffset being the offset of the
  // end-node, if it's a text node. Otherwise, it's undefined.
  // { start: { path: [1, 2, 3], offset: 32, textOffset: 2 },
  //   end: undefined } // collapsed
  if (!range) {
    return;
  }
  return {
    start: getNodePath(range.startContainer, range.startOffset, rootEl),
    end: range.collapsed ? undefined : getNodePath(range.endContainer, range.endOffset, rootEl),
  };
}

/**
 * Attach the specified detached range to the specified root element.
 */
export function attachTo(detachedRange: DetachedRange | undefined, rootEl: Element) {
  if (!detachedRange || detachedRange.start.offset < 0) {
    return;
  }
  const start = resolveNodePath(detachedRange.start, rootEl);
  const end = resolveNodePath(detachedRange.end, rootEl);
  const range = document.createRange();
  start && range.setStart(start.node, start.offset);
  end && range.setEnd(end.node, end.offset);
  return range;
}

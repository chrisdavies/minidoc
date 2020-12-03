/**
 * This file handles toggling of inline tags, such as strong, em, etc.
 * Out of the box, the browser really bungles this. The logic is complex,
 * but seems necessary.
 *
 * The basics are as follows:
 * - In the current selection, create a list of ranges that surround inlinable content
 *   - For example, p, div, h1 are not inlinable, but their contents may be
 * - If all of them are already within the desired element (e.g. strong), remove the element
 * - Else, surround them with the element
 *
 * In addition to that, we want to always make sure we normalize the final content, merging
 * any contiguous <strong> elements, for example, removing any empty text nodes, etc.
 */

import * as Rng from '../range';
import * as Dom from '../dom';
import { h } from '../dom';

function normalizeSelector(tagName: string) {
  switch (tagName) {
    case 'b':
    case 'strong':
      return 'b,strong';
    case 'i':
    case 'em':
      return 'i,em';
    default:
      return tagName;
  }
}

/**
 * Append b's content into a (and remove b) if both a and b match the selector.
 */
function mergeMatchingNodes(selector: string, a: Node | null, b: Node | null) {
  if (Dom.isElement(a) && a.matches(selector) && Dom.isElement(b) && b.matches(selector)) {
    Dom.appendChildren(Array.from(b.childNodes), a);
    b.remove();
    return a;
  }
}

/**
 * Ensure the element is contiguous with related elements. In other words,
 * <b>hi</b><b>there</b> -> <b>hi there</b>
 * <b>hi <b>there</b></b> -> <b>hi there</b>
 */
function makeContiguous(tagName: string, el: Element) {
  const selector = normalizeSelector(tagName);
  Array.from(el.children).forEach((child) => {
    if (child.matches(selector)) {
      Array.from(child.childNodes).forEach((n) => el.insertBefore(n, child));
      child.remove();
    }
  });
  const children = Array.from(el.childNodes);
  if (el.parentElement?.closest(selector)) {
    const parent = el.parentElement!;
    children.forEach((child) => parent.insertBefore(child, el));
    el.remove();
    el = parent;
  }
  el = mergeMatchingNodes(selector, el.previousSibling, el) || el;
  el = mergeMatchingNodes(selector, el, el.nextSibling) || el;
  return children.filter((c) => c.isConnected);
}

/**
 * Create a single range that encompasses the array of ranges.
 */
function toRange(ranges: Range[]) {
  const range = ranges[0].cloneRange();
  const tail = ranges[ranges.length - 1];
  range.setEnd(tail.endContainer, tail.endOffset);
  return range;
}

/**
 * Get a set of tags between node and its ancestor that matches the selector.
 */
function getInlineTags(until: string, node: Node | undefined) {
  const tagNames = new Set<string>();
  let el: Element | undefined = Dom.isElement(node) ? node : node?.parentElement || undefined;
  while (el && !el.matches(until) && !Dom.isBlock(el)) {
    tagNames.add(el.tagName);
    el = el.parentElement || undefined;
  }
  return tagNames;
}

/**
 * Removes the inline tag from the range.
 */
function unapply(tagName: string, r: Range) {
  const selector = normalizeSelector(tagName);
  // Track all tags between our range and the ancestor we're leaving.
  // So, if we are attempting to remove b from this: <b><i>foo</i></b>
  // we'll end up with <i>foo</i> rather than just foo.
  const tagNames = getInlineTags(selector, Rng.toNode(r));

  // Remove the content. We'll sanitize it and re-insert it in a bit.
  let content: Element | DocumentFragment = r.extractContents();

  // If we're in a subsection of a larger tag, we'll split that tag
  // so that we can sandwich our final (unstyled) content within two
  // styled tags.
  const closest = Dom.closest(selector, Rng.toNode(r));
  if (closest) {
    r.setEndAfter(closest);
    const tailContent = r.extractContents();
    !Dom.isEmpty(tailContent) && r.insertNode(tailContent);
  }

  // Remove all children that match the inline selector.
  Array.from(content.querySelectorAll(selector)).forEach((n) => Dom.replaceSelfWithChildren(n));
  r.collapse(true);

  // Restore our tag names, if any
  tagNames.forEach((tag) => {
    content = h(tag, content);
  });

  // Insert our cleaned up content.
  r.insertNode(content);
}

function shouldEnable(selector: string, ranges: Range[]) {
  const node = Rng.toNode(ranges[0]);
  const el = Dom.isElement(node) ? node : node?.parentElement;
  const isWithin = el?.closest(selector);
  const contains = Dom.isElement(node) && node.querySelector(selector);
  return !isWithin && !contains;
}

export function toggleInline(tagName: string, range: Range) {
  const selector = normalizeSelector(tagName);
  const ranges = Rng.inlinableRanges(range);
  if (!ranges.length) {
    return;
  }
  if (shouldEnable(selector, ranges)) {
    ranges.forEach((r) => {
      const el = h(tagName, r.extractContents());
      r.insertNode(el);
      const children = makeContiguous(tagName, el);
      r.setStart(children[0], 0);
      r.setEndAfter(children[children.length - 1]);
    });
  } else {
    ranges.forEach((r) => unapply(tagName, r));
  }
  const container = Rng.setCurrentSelection(toRange(ranges)).commonAncestorContainer as Element;
  container.normalize();
  Array.from(container.querySelectorAll(selector)).forEach((n) => Dom.isEmpty(n) && n.remove());
}

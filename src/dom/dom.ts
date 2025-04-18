import type { Cardable } from '../card';
import type { Serializable } from '../minidoc/core-mixin';
import type { ImmutableLeaf, MinidocBase } from '../types';
import { last } from '../util';

type Eachable = { forEach: (...args: any) => void };
type ItemOrList<T> = T | Eachable;

/**
 * Add event listener to the element, and return the dispose / off function.
 */
export function on<
  K extends keyof HTMLElementEventMap,
  T extends Pick<Element, 'addEventListener' | 'removeEventListener'>,
>(
  el: T,
  type: K,
  fn: (this: T, ev: HTMLElementEventMap[K]) => any,
  opts?: boolean | AddEventListenerOptions,
): () => any;
export function on<T extends Pick<Element, 'addEventListener' | 'removeEventListener'>>(
  el: T,
  type: string,
  fn: EventListenerOrEventListenerObject,
  opts?: boolean | AddEventListenerOptions,
): () => any;
export function on<T extends Pick<Element, 'addEventListener' | 'removeEventListener'>>(
  el: T,
  type: string,
  fn: EventListenerOrEventListenerObject,
  opts?: boolean | AddEventListenerOptions,
): () => any {
  el.addEventListener(type, fn as any, opts);
  return () => el.removeEventListener(type, fn as any, opts);
}

/**
 * Emit a custom event with the specified detail.
 */
export function emit<T>(el: Element, type: string, detail?: T) {
  el.dispatchEvent(new CustomEvent<T>(type, { detail }));
}

/**
 * Determine if the node is a text node.
 */
export function isText(node: any): node is Text {
  return node instanceof Text;
}

/**
 * Determine if the node is an Element.
 */
export function isElement(node: any): node is HTMLElement {
  return node instanceof HTMLElement;
}

/**
 * Attempt to convert the node to the closest element (inclusive)
 */
export function toElement(node: Node) {
  return isElement(node) ? node : node.parentElement;
}

/**
 * Determine if the specified node is in the editable content of a
 * minidoc editor.
 */
export function isInEditor(node?: Node): boolean {
  const el = isElement(node) ? node : node?.parentElement;
  return !!el?.closest('[contenteditable]');
}

/**
 * Determine if the node is an editor root (contenteditable).
 */
export function isRoot(node: any): boolean {
  return isElement(node) && (node as HTMLDivElement).contentEditable === 'true';
}

/**
 * Determine if the specified item is a minidoc card.
 */
export function isCard(n: any, editor: MinidocBase): n is HTMLElement {
  const cardable = editor as unknown as Cardable;
  return (
    isElement(n) &&
    (n.tagName === 'MINI-CARD' || (!!cardable.$cardSelector && n.matches(cardable.$cardSelector)))
  );
}

/**
 * Determine if the node is iterable.
 */
function isIterable<T = any>(x: any): x is Eachable & Iterable<T> {
  return !!x?.forEach;
}

/**
 * Determine if the node is the root of an html list (ul / ol).
 */
export function isList(el: any): el is HTMLOListElement | HTMLUListElement {
  return el?.matches?.('ul,ol');
}

export function walk(node: Node, filter: number, handler: (n: Node) => boolean | undefined | void) {
  const treeWalker = document.createTreeWalker(node, filter);

  let currentNode: Node | null = treeWalker.currentNode;

  while (currentNode) {
    if (handler(currentNode)) {
      return true;
    }
    currentNode = treeWalker.nextNode();
  }

  return false;
}

/**
 * Determine if the node is empty.
 */
export function isEmpty(node: Node): boolean {
  // This is a bit of a hack, to say the least. But it turns out there are
  // scenarios where the node appears to have content (e.g. a space or something),
  // but it renders as empty. This attempts to capture that.
  if (node.isConnected && node instanceof HTMLElement && !node.offsetHeight) {
    return true;
  }

  if (!node || (isText(node) && node.length === 0)) {
    return true;
  }

  return !walk(
    node,
    NodeFilter.SHOW_TEXT,
    (currentNode) => currentNode instanceof Text && !!currentNode.length,
  );
}

/**
 * Curried version of closest. Find the closest matching node, inclusive.
 * @param selector
 */
export function closest(selector: string): (node: Node) => Element | undefined;
/**
 * Find the closest matching node, inclusive.
 * @param selector
 * @param node
 */
export function closest(selector: string, node?: Node): Element | undefined;
export function closest(selector: string, node?: Node): any {
  if (arguments.length === 1) {
    return (n: Node) => closest(selector, n);
  }
  if (!node) {
    return undefined;
  }
  const el = isElement(node) ? node : node!.parentElement!;
  return el.closest(selector) || undefined;
}

/**
 * Replaces node with its children.
 */
export function replaceSelfWithChildren(node?: Node) {
  if (!isElement(node)) {
    return;
  }
  const r = document.createRange();
  r.selectNodeContents(node);
  const children = r.extractContents();
  const childArr = Array.from(children.childNodes);
  node.replaceWith(children);
  if (childArr.length) {
    r.selectNode(last(childArr)!);
    r.setStart(childArr[0], 0);
  }
  return r;
}

/**
 * Retrieves teh specified attribute from the node.
 */
export function attr(name: string, node?: Node) {
  return (isElement(node) && node.getAttribute(name)) || undefined;
}

/**
 * Insert newNode after the specified node.
 */
export function insertAfter(newNode: Node, node: Node): Node {
  node.parentNode!.insertBefore(newNode, node.nextSibling);
  return newNode;
}

/**
 * Remove the specified node from the DOM.
 */
export function remove(node?: Node) {
  return node?.parentElement?.removeChild(node);
}

/**
 * Find the leaf node (the direct child of the editor root) which
 * contains the specified node.
 */
export function findLeaf(node: Node): Element | undefined {
  while (true) {
    const parent = node.parentElement;
    if (!parent) {
      return node.isConnected ? undefined : (node as Element);
    }
    if (isRoot(parent)) {
      return isElement(node) ? node : undefined;
    }
    node = parent;
  }
}

/**
 * Find the leaf nodes between the two nodes, inclusive.
 */
export function findLeafs(startNode: Node, endNode: Node): Element[] {
  const startLeaf = findLeaf(startNode);
  const endLeaf = findLeaf(endNode);
  const leafs: Element[] = startLeaf ? [startLeaf] : [];
  let node: Element | undefined = startLeaf;
  while (node && node !== endLeaf) {
    node = node.nextElementSibling || undefined;
    node && leafs.push(node);
  }
  return leafs;
}

/**
 * Determine if x is an object of html attributes. (e.g. { class: 'foo', onclick: () => {} })
 */
const isAttr = (x: any) =>
  x &&
  typeof x === 'object' &&
  !Array.isArray(x) &&
  !(x instanceof NodeList) &&
  !(x instanceof HTMLCollection) &&
  !(x instanceof Node) &&
  !(x.el instanceof Node);

/**
 * Append a child to el.
 */
function appendChild<T extends Node | Range | undefined>(child: Node | string, el: T): T {
  if (!child) {
    return el;
  }
  const node = typeof child === 'string' ? document.createTextNode(child) : child;
  if (el instanceof Range) {
    el.insertNode(node);
    el.collapse();
  } else if (el instanceof Node) {
    el.appendChild(node);
  }
  return el;
}

export function toFragment(
  children?: ItemOrList<Node | string>,
  frag?: DocumentFragment,
): DocumentFragment {
  frag ||= document.createDocumentFragment();
  if (children instanceof Node || typeof children === 'string') {
    return appendChild(children, frag);
  } else if (isIterable(children)) {
    Array.from(children).forEach((n) => n && toFragment(n, frag));
  }
  return frag;
}

export function toHTML(n: Node) {
  const serializable = n as Serializable & Element;
  if (serializable.serialize) {
    return serializable.serialize();
  }
  if (isElement(n)) {
    return n.outerHTML;
  }
  if (n instanceof DocumentFragment) {
    return h('div', n).innerHTML;
  }
  throw new Error(`Node ${n.nodeType} cannot be converted to HTML.`);
}

/**
 * Append the specified child / children to the specified element.
 */
export function appendChildren<T extends Element | Range>(
  children: ItemOrList<Node | string>,
  el: T,
): T {
  if (isElement(el)) {
    el.appendChild(toFragment(children));
  } else {
    (el as Range).insertNode(toFragment(children));
  }
  return el;
}

/**
 * Assign the specified attributes to the element.
 */
export function assignAttrs(attrs: { [k: string]: any }, el: Element): Element {
  if (el && attrs) {
    Object.keys(attrs).forEach((k) => {
      const val = attrs[k];
      if (k === 'class' || k === 'className') {
        const classes = val && val.split(' ');
        classes && classes.length && el.classList.add(...classes);
      } else if (
        k === 'innerHTML' ||
        k === 'textContent' ||
        typeof val === 'function' ||
        k.startsWith('$')
      ) {
        (el as any)[k] = val;
      } else if (val !== false && val !== undefined && val !== null) {
        el.setAttribute(k, val);
      }
    });
  }
  return el;
}

/**
 * Create an element.
 * @param {string} tag the tag name and / or classes (e.g. span.bright)
 * @param  {...any} args attributes object, and / or child nodes, text content, etc.
 * @returns {Element}
 */
export function h<T extends HTMLElement>(tag: string, ...args: any): T {
  const [tagName, ...classes] = tag.split('.');
  const el = document.createElement(tagName || 'div');
  const arg0 = args[0];
  const attrs = isAttr(arg0) && arg0;
  if (classes.length) {
    el.className = classes.join(' ');
  }
  assignAttrs(attrs, el);
  appendChildren(attrs ? args.slice(1) : args, el);
  return el as unknown as T;
}

export function newLeaf(element: 'p' | 'h3' | 'ul' = 'p') {
  return h(element, h('br'));
}

/**
 * Check to see if the node is an uneditable node type.
 * @param node
 */
function isUneditable(node: Node) {
  return isElement(node) && node.matches('hr,img,video,audio');
}

/**
 * Ensure the specified node is editable. This is mutative.
 */
export function $makeEditable(node: Node): Node {
  if (!isEmpty(node) || node.lastChild instanceof HTMLBRElement || isUneditable(node)) {
    return node;
  }
  if (isList(node)) {
    appendChildren(h('li', h('br')), node);
  } else if (isRoot(node)) {
    appendChild(newLeaf(), node);
  } else if (isElement(node)) {
    appendChild(h('br'), node);
  }
  return node;
}

const blockSelector =
  'div,p,li,ul,ol,h1,h2,h3,h4,h5,hr,section,footer,header,nav,blockquote,table,td,th,hr,mini-card';

export function isBlock(node: Node) {
  return isElement(node) && node.matches(blockSelector);
}

export function isImmutable(node?: Node) {
  return isElement(node) && (node as ImmutableLeaf).$immutable;
}

/**
 * Find the closest block element that contains the specified node.
 */
export function closestBlock(node: Node): Element | undefined {
  const el = node instanceof Element ? node : node.parentElement!;
  const block = el?.closest(blockSelector) || undefined;
  return isRoot(block) ? undefined : block;
}

/**
 * Merge the children of fromList into the children of toList, inserting them before
 * beforeEl, if it's specified. This removes fromList from the DOM.
 */
export function mergeLists(fromList: Element, toList: Element, beforeEl?: Element) {
  fromList.remove();
  Array.from(fromList.children).forEach((li) => toList?.insertBefore(li, beforeEl || null));
}

type Eachable = { forEach: (...args: any) => void };
type ItemOrList<T> = T | Eachable;

/**
 * Add event listener to the element, and return the dispose / off function.
 */
export function on<
  K extends keyof HTMLElementEventMap,
  T extends Pick<Element, 'addEventListener' | 'removeEventListener'>
>(el: T, evt: K, fn: (e: HTMLElementEventMap[K]) => any, opts?: boolean | EventListenerOptions) {
  el.addEventListener(evt, fn as any, opts);
  return () => el.removeEventListener(evt, fn as any, opts);
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
export function isElement(node: any): node is Element {
  return node instanceof Element;
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
export function isRoot(node: any): node is Element {
  return isElement(node) && (node as HTMLDivElement).contentEditable === 'true';
}

/**
 * Determine if the node is iterable.
 */
function isIterable<T = any>(x: any): x is Eachable & Iterable<T> {
  return !!x.forEach;
}

/**
 * Determine if the node is the root of an html list (ul / ol).
 */
export function isList(el: any): el is HTMLOListElement | HTMLUListElement {
  return el?.matches('ul,ol');
}

/**
 * Determine if the node is empty.
 */
export function isEmpty(node: Node, ignoreBrs?: boolean): boolean {
  if (!node || (isText(node) && node.length === 0)) {
    return true;
  }

  const treeWalker = document.createTreeWalker(
    node,
    NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
  );

  let currentNode: Node | null = treeWalker.currentNode;

  while (currentNode) {
    if (currentNode instanceof Text && currentNode.length) {
      return false;
    }
    if (
      (currentNode as Element).tagName === 'MINI-CARD' ||
      (!ignoreBrs && (currentNode as Element).tagName === 'BR')
    ) {
      return false;
    }
    currentNode = treeWalker.nextNode();
  }

  return true;
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
    r.selectNode(childArr[childArr.length - 1]);
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
  node.parentElement!.insertBefore(newNode, node.nextSibling);
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
      return;
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
  !(x instanceof Node) &&
  !(x.el instanceof Node);

/**
 * Append a child to el.
 */
function appendChild(child: Node | string, el: Element | Range | undefined) {
  if (!child) {
    return el;
  }
  const node = typeof child === 'string' ? document.createTextNode(child) : child;
  if (el instanceof Range) {
    el.insertNode(node);
    el.collapse();
  } else if (el) {
    el.appendChild(node);
  }
  return el;
}

/**
 * Append the specified child / children to the specified element.
 */
export function appendChildren(children: ItemOrList<Node | string>, el: Element | Range) {
  if (children instanceof Node || typeof children === 'string') {
    return appendChild(children, el);
  } else if (isIterable(children)) {
    Array.from(children).forEach((n) => n && appendChildren(n, el));
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
        val && el.classList.add(...val.split(' '));
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
export function h<T extends Element>(tag: string, ...args: any): T {
  const [tagName, ...classes] = tag.split('.');
  const el = document.createElement(tagName || 'div');
  const arg0 = args[0];
  const attrs = isAttr(arg0) && arg0;
  if (classes.length) {
    el.className = classes.join(' ');
  }
  assignAttrs(attrs, el);
  appendChildren(attrs ? args.slice(1) : args, el);
  return (el as unknown) as T;
}

export function newLeaf() {
  return h('p', h('br'));
}

/**
 * Ensure the specified node is editable. This is mutative.
 */
export function $makeEditable(node: Node): Node {
  if (!isEmpty(node)) {
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

const blockSelector = 'div,p,li,ul,ol,h1,h2,h3,h4,h5,section,footer,header,nav,table';

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

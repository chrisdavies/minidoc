import { defCalRoute } from './common';

export const route = defCalRoute({ isPublic: true, Page });

function firstNonEmptyText(n: Node | null) {
  if (!n) {
    return n;
  }
  const treeWalker = document.createTreeWalker(n, NodeFilter.SHOW_TEXT);
  while (treeWalker.nextNode()) {
    if ((treeWalker.currentNode as Text).length) {
      return treeWalker.currentNode;
    }
  }
  return null;
}

function closestEl(node: Node | null | undefined) {
  return node instanceof Element ? node : node?.parentElement;
}

function closestBlock(node: Node | null | undefined) {
  let el = closestEl(node);
  while (el) {
    if (!getComputedStyle(el).display.startsWith('inline')) {
      return el;
    }
    el = el.parentElement;
  }
}

function insertBrIfEmpty(node: Element | null) {
  if (!node) {
    return;
  }
  let text = firstNonEmptyText(node);
  if (text) {
    return text;
  }
  if (!node.querySelector('br')) {
    node.append(document.createElement('br'));
  }
}

function extractContents(node: Node | null) {
  const frag = document.createDocumentFragment();
  if (node) {
    frag.append(...Array.from(node.childNodes));
  }
  return frag;
}

const legalInline = [
  'a',
  'abbr',
  'audio',
  'b',
  'bdo',
  'br',
  'button',
  'canvas',
  'cite',
  'code',
  'data',
  'datalist',
  'del',
  'dfn',
  'em',
  'embed',
  'i',
  'iframe',
  'img',
  'input',
  'ins',
  'kbd',
  'label',
  'mark',
  'math',
  'meter',
  'noscript',
  'object',
  'output',
  'picture',
  'progress',
  'q',
  'ruby',
  'samp',
  'script',
  'select',
  'slot',
  'small',
  'span',
  'strong',
  'sub',
  'sup',
  'svg',
  'template',
  'textarea',
  'time',
  'u',
  'var',
  'video',
  'wbr',
];
const legalInlineSelector = legalInline.join(',');

/**
 * Merge a right into b.
 */
function mergeRight(a: Node | null, b: Node | null) {
  if (!(a instanceof HTMLElement)) {
    return a;
  }
  if (!(b instanceof HTMLElement)) {
    return a;
  }
  if (a.tagName !== b.tagName) {
    return a;
  }
  if (a.matches(legalInlineSelector) || b.matches(legalInlineSelector)) {
    return a;
  }
  const nextA = a.lastChild;
  const nextB = b.firstChild;
  b.prepend(extractContents(a));
  a.remove();
  return mergeRight(nextA, nextB);
}

/**
 * Merge a left into b.
 */
function mergeLeft(a: Node | null, b: Node | null) {
  if (!(a instanceof HTMLElement)) {
    return a;
  }
  if (!(b instanceof HTMLElement)) {
    return a;
  }
  if (a.tagName !== b.tagName) {
    return a;
  }
  if (a.matches(legalInlineSelector) || b.matches(legalInlineSelector)) {
    return a;
  }
  const nextA = a.firstChild;
  const nextB = b.lastChild;
  b.append(extractContents(a));
  a.remove();
  return mergeLeft(nextA, nextB);
}

function removeMark(sel: Selection | null, selector: string) {
  const range = sel?.getRangeAt(0);
  if (!range) {
    return;
  }

  // If our selection is a subset of a single instance of the specified
  // mark, we'll split the mark in two.
  const start = closestEl(range.startContainer)?.closest(selector);
  const end = start && closestEl(range.endContainer)?.closest(selector);
  let frag: DocumentFragment;
  if (start !== end || !start) {
    frag = range.extractContents();
  } else {
    const prefix = document.createRange();
    prefix.setStartBefore(start);
    prefix.setEnd(range.startContainer, range.startOffset);
    const prefixContent = prefix.extractContents();
    frag = range.extractContents();
    start.parentNode?.insertBefore(prefixContent, start);
    range.setStartBefore(start);
  }

  frag.querySelectorAll(selector).forEach((n) => {
    n.replaceWith(...Array.from(n.childNodes));
  });

  insertFrag(frag, range);
}

function insertFrag(frag: DocumentFragment, range: Range) {
  // Insert frag...
  const isInlineFrag =
    !frag.firstElementChild ||
    (frag.firstElementChild?.matches(legalInlineSelector) &&
      frag.lastElementChild?.matches(legalInlineSelector));
  if (isInlineFrag) {
    const a = frag.firstChild;
    const b = frag.lastChild;
    range.insertNode(frag);
    if (a && b) {
      range.selectNodeContents(b);
      range.setStart(a, 0);
    }
    return;
  }

  // We have a range that crosses block elements, aka an open range.
  const firstChild = frag.firstChild;
  const lastChild = frag.lastChild;
  range.insertNode(frag);

  if (firstChild && firstChild.previousSibling instanceof HTMLElement) {
    const startNode = mergeLeft(firstChild, firstChild.previousSibling);
    startNode && range.setStart(startNode, 0);
  }

  if (lastChild && lastChild.nextSibling instanceof HTMLElement) {
    const endNode = mergeRight(lastChild, lastChild.nextSibling);
    endNode && range.setEndAfter(endNode);
  }
}

function applyMark(sel: Selection | null, mark: string, selector: string) {
  removeMark(sel, selector);
  const range = sel?.getRangeAt(0);
  if (!range) {
    return;
  }

  // Here, we walk the entire selection, breaking it into sub-ranges
  // which can each legally be wrapped in an inline tag.
  const frag = range.extractContents();
  const walker = document.createTreeWalker(frag, NodeFilter.SHOW_ALL);
  const markers: Range[] = [];
  let marker: Range | null = null;

  const addMarkable = (node: Node) => {
    if (!marker) {
      marker = document.createRange();
      marker.selectNode(node);
    }
    marker.setEndAfter(node);
  };

  const closeMarker = () => {
    if (marker) {
      markers.push(marker);
      marker = null;
    }
  };

  while (walker.currentNode) {
    const node = walker.currentNode;
    if (node instanceof Text || (node as HTMLElement).matches?.(legalInlineSelector)) {
      addMarkable(node);
    } else {
      closeMarker();
    }
    if (!walker.nextNode()) {
      break;
    }
  }
  closeMarker();

  // Surround each valid section with the mark
  for (const r of markers) {
    const wrap = document.createElement(mark);
    wrap.append(r.extractContents());
    r.insertNode(wrap);
  }

  // Re-insert the extracted fragment
  insertFrag(frag, range);
}

function insertParagraph(sel: Selection | null, blockSelector: string) {
  const anchorNode = sel?.anchorNode;
  const el = closestEl(anchorNode);
  if (!el || !sel || !anchorNode) {
    return;
  }
  const block = el.closest(blockSelector);
  const parent = block?.parentElement;
  if (!block || !parent) {
    return;
  }
  const range = document.createRange();
  range.setStart(anchorNode, sel.anchorOffset);
  range.setEndAfter(block);
  const frag = range.extractContents();
  const first = frag.firstChild;
  if (!first) {
    return;
  }
  parent.insertBefore(frag, block.nextSibling);
  const text = insertBrIfEmpty(first as Element);
  insertBrIfEmpty(block);
  sel.setPosition(text || first, 0);
  first.normalize();
  block.normalize();
}

function deleteExpandedSelection(sel: Selection | null, root: HTMLElement) {
  if (!sel || sel.isCollapsed) {
    return;
  }
  const { startContainer, endContainer } = sel.getRangeAt(0)!;

  const startBlock = closestBlock(startContainer);
  const endBlock = closestBlock(endContainer);
  sel.deleteFromDocument();

  if (startBlock === endBlock || !startBlock || !endBlock) {
    // We've deleted everything. Need to ensure we're in the
    // default allowable element which should be configurable,
    // but for now we're hard-coding to "p".
    if (sel.anchorNode === root) {
      const p = document.createElement('p');
      p.innerHTML = '<br>';
      sel.getRangeAt(0)?.insertNode(p);
      sel.setPosition(p, 0);
    }
    return;
  }

  const range = document.createRange();
  range.selectNodeContents(endBlock);
  sel.selectAllChildren(startBlock);
  sel.collapseToEnd();
  startBlock.append(range.extractContents());
  endBlock.remove();
}

function selectionHasMark(sel: Selection | null, selector: string) {
  const range = sel?.getRangeAt(0);
  if (!range) {
    return;
  }
  if (closestEl(range.startContainer)?.closest(selector)) {
    return true;
  }
  if (closestEl(range.endContainer)?.closest(selector)) {
    return true;
  }
  let siblingEl = (range.startContainer as HTMLElement).nextElementSibling;
  if (siblingEl && range.intersectsNode(siblingEl) && siblingEl.matches(selector)) {
    return true;
  }
  siblingEl = (range.endContainer as HTMLElement).previousElementSibling;
  if (siblingEl && range.intersectsNode(siblingEl) && siblingEl.matches(selector)) {
    return true;
  }
}

/**
 * Toggle a mark b, strong, em, i, u, etc
 */
function toggleMark(sel: Selection | null, marks: string[]) {
  const [mark] = marks;
  const selector = marks.join(',');
  const range = sel?.getRangeAt(0);
  if (!range) {
    return;
  }
  if (selectionHasMark(sel, selector)) {
    removeMark(sel, selector);
  } else {
    applyMark(sel, mark, selector);
  }
}

function mini2(el: HTMLElement | null) {
  const root = el as HTMLElement & { $editor?: any };
  if (!root || root.$editor) {
    return;
  }

  // TODO: these should be driven by the configuration-- what blocks have been
  // defined in a schema, etc
  const blockSelector = 'h1,h2,h3,h4,h5,p';
  // const markSelector = 'b,strong,em,i,a,u';
  const marks: Record<string, string[]> = {
    formatBold: ['strong', 'b'],
    formatUnderline: ['u'],
    formatItalic: ['em', 'i'],
  };

  root.$editor = {};
  root.contentEditable = 'true';
  const toggledMarks = new Set<string>();

  // Convert certain keydown events into standard beforeinput events
  // so we can handle everything in that single event handler.
  root.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && 'biu'.includes(e.key)) {
      e.preventDefault();
      e.target?.dispatchEvent(
        new InputEvent('beforeinput', {
          bubbles: true,
          cancelable: true,
          inputType:
            e.key === 'b' ? 'formatBold' : e.key === 'i' ? 'formatItalic' : 'formatUnderline',
        }),
      );
    }
  });

  // The central event handler for all editor changes.
  root.addEventListener('beforeinput', (e) => {
    const sel = document.getSelection();
    if (!sel) {
      return;
    }
    const isMarkToggle = ['formatBold', 'formatItalic', 'formatUnderline'].includes(e.inputType);
    if (!isMarkToggle) {
      if (e.inputType === 'insertText' && sel.isCollapsed) {
        // Create a placeholder node " ", and then toggle
        // the marks for it. We'll let the browser handle
        // the actual typing.
        const text = document.createTextNode(' ');
        const range = sel.getRangeAt(0);
        range.insertNode(text);
        range.selectNode(text);

        Array.from(toggledMarks).forEach((inputType) => {
          toggleMark(sel, marks[inputType]);
        });
      }
      toggledMarks.clear();
    }

    // We don't handle selections yet
    if (!sel.isCollapsed) {
      const isDelete = ['deleteContentBackward', 'deleteContentForward'].includes(e.inputType);
      const isReplace = !isDelete && ['insertText', 'insertParagraph'].includes(e.inputType);

      if (isDelete || isReplace) {
        deleteExpandedSelection(sel, root);
      }
      if (isMarkToggle) {
        toggleMark(sel, marks[e.inputType]);
      }

      if (!isReplace) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
    }

    const { anchorNode } = sel;
    if (!anchorNode) {
      return;
    }

    // Allow normal text input if the selection is collapsed.
    // Browsers handle this case natively.
    if (e.inputType === 'insertText') {
      return;
    }
    // If we're backspacing / deleting in a collapsed selection which
    // browsers seem to handle properly.
    if (e.inputType === 'deleteContentBackward' || e.inputType === 'deleteContentForward') {
      return;
    }
    // Toggle the marks. This will get applied when the user next performs insertText.
    // any other action (other than toggling a different mark) will reset this.
    if (isMarkToggle) {
      toggledMarks.has(e.inputType)
        ? toggledMarks.delete(e.inputType)
        : toggledMarks.add(e.inputType);
    }

    // Plugins need to be able to override this. If we're in an inline-only
    // element such as a figcaption, we would either want to insert a br, or
    // noop, or insert a paragraph beneath the figure, etc.
    // In an li, it will insert another li, etc.
    if (e.inputType === 'insertParagraph') {
      insertParagraph(sel, blockSelector);
    }

    e.preventDefault();
    e.stopPropagation();
  });
}

function Page() {
  return (
    <div class="min-h-screen bg-gradient-to-b from-sky-100 via-indigo-100 to-violet-100 relative p-8 text-base">
      <div
        class="minidoc-content w-full max-w-readable mx-auto jsprose whitespace-pre-wrap outline-none p-6 rounded-2xl focus:ring-2 ring-indigo-600"
        ref={mini2}
      >
        <h1>Welcome to ProseMirror</h1>
        <p>
          This is a <em>paragraph</em> <b>followed</b> by an image.
        </p>
        <p>A second paragraph helps with some scenarios.</p>
        <p>We'll get more complex later.</p>
        <figure>
          <img src="https://images.unsplash.com/photo-1463453091185-61582044d556" alt="Dude" />
          <figcaption>
            Now <em>This</em> is an image.
          </figcaption>
        </figure>
        <ul>
          <li>
            Well, I'll be derned
            <ol>
              <li>Firstly</li>
              <li>Secondly</li>
            </ol>
          </li>
          <li>This is working ok</li>
        </ul>
        <p>A final paragraph 4 u</p>
      </div>
    </div>
  );
}


/**
 * This file manages all copy / cut / paste functionality. Clipboard logic is edgecasey.
 * The baked in contenteditable really mangles it. This module attempts to sovle that.
 *
 * Originally, I'd planned on making each plugin (list, card, etc) handle its own copy / paste,
 * but getting that to be truly pluggable and extensible requires a capacity for time and thought
 * that I don't currently have. That's a longer-term todo, though.
 */
import * as Dom from '../dom';
import * as Rng from '../range';
import { last } from '../util';
import { MinidocBase } from '../types';
import { Changeable } from '../undo-redo';
import { Mountable } from '../mountable';
import { Scrubbable } from '../scrubbable';
import { h } from '../dom';
import { inferMiddleware } from '../mixins';

function stripBrs(el: Node) {
  Dom.isElement(el) && Array.from(el.querySelectorAll('br')).forEach((n) => n.remove());
  return el;
}

/**
 * Convert any URL-like text into hyperlinks.
 */
function linkify(node: Node) {
  const textNodes: Text[] = [];
  const urls = /(https?:\/\/[^\s]+)/;

  Dom.walk(node, NodeFilter.SHOW_TEXT, (n) => {
    const t = n as Text;
    if (urls.test(t.textContent || '') && !n.parentElement?.closest('a') && t.replaceWith) {
      textNodes.push(t);
    }
  });

  textNodes.forEach((n) => {
    n.replaceWith(
      ...n.textContent!.split(urls).map((s) => {
        if (s.startsWith('http://') || s.startsWith('https://')) {
          return h('a', { href: s }, s);
        }
        return s;
      }),
    );
  });
}

/**
 * Convert the specified document fragment into Elements that are
 * valid as document leaf nodes.
 */
function convertToLeafs(frag?: DocumentFragment) {
  if (!frag) {
    return;
  }

  let leaf: Node | undefined;

  linkify(frag);

  // Leaf nodes must be blocks. E.g. a span cannot be a leaf node.
  // This moves all non-blocks into a block, while retaining any
  // blocks which are in the document fragment.
  Array.from(frag.childNodes).forEach((n) => {
    if (Dom.isBlock(n)) {
      leaf = undefined;
    } else {
      if (!leaf) {
        leaf = Dom.newLeaf();
        frag.insertBefore(leaf, n);
      }
      leaf.appendChild(n);
    }
  });

  // Sanitize and remove any empty leafs from the fragment
  Array.from(frag.childNodes).forEach((n) => {
    Dom.$makeEditable(stripBrs(n));
  });

  return frag;
}

function readClipboard(
  e: ClipboardEvent,
  editor: MinidocBase & Mountable & Scrubbable,
): DocumentFragment | undefined {
  const { clipboardData } = e;

  if (!clipboardData) {
    return;
  }

  const rawHtml = clipboardData.getData('text/html');
  if (rawHtml) {
    return editor.scrub(Dom.toFragment(h('div', { innerHTML: rawHtml }).childNodes));
  }

  const text = clipboardData.getData('text/plain');
  if (text) {
    return Dom.toFragment(
      text
        .split('\n')
        .filter((s) => s.length)
        .map((s) => h('p', s)),
    );
  }
}

function extractCopyContent(range: Range) {
  const leafs = Rng.findLeafs(range);
  const startLeaf = leafs[0];
  const endLeaf = leafs[leafs.length - 1];

  // If we're copying the children of a list, we need to convert the copied
  // content to a full list (e.g. ol / ul so that we paste the right thing)
  if (leafs.length === 1 && Dom.isList(startLeaf)) {
    const content = range.cloneContents();
    const listContent =
      !Dom.isElement(content?.firstChild) || !content?.firstChild.matches('li')
        ? h('li', content)
        : content;
    return [h(startLeaf.tagName, listContent)];
  }

  return leafs.map((el) => {
    if ((el as any).serialize) {
      return el;
    }
    const tmp = Rng.createRange();
    if (el.contains(startLeaf)) {
      tmp.setStart(range.startContainer, range.startOffset);
    } else {
      tmp.setStartBefore(el);
    }
    if (el.contains(endLeaf)) {
      tmp.setEnd(range.endContainer, range.endOffset);
    } else {
      tmp.setEndAfter(el);
    }
    return tmp.cloneContents();
  });
}

function moveToClipboard(e: ClipboardEvent, isCut: boolean) {
  e.preventDefault();
  const dataTransfer = e.clipboardData;
  const range = Rng.currentRange();

  if (!dataTransfer || !range) {
    return;
  }

  const content = extractCopyContent(range);
  if (content.length) {
    dataTransfer.setData('text/plain', content.map((el) => el.textContent).join('\n\n'));
    dataTransfer.setData('text/html', content.map((n) => Dom.toHTML(n)).join(''));
  }
  if (!isCut) {
    return;
  }
  Rng.$deleteAndMergeContents(range);
  if (content.length === 1 && Dom.isImmutable(content[0])) {
    (content[0] as Element).remove();
  }
}

function insertBelow(content: DocumentFragment, ref: Node) {
  const lastEl = content.lastElementChild!;
  Dom.insertAfter(content, ref);
  return Rng.fromNodes([lastEl]);
}

/**
 * This splits the specified range and sandwiches the content as new leafs.
 * It attempts to merge the first slice of the sandwich with the first
 * element in content, and the last slice of the sandwich with the last element
 * in content.
 */
function splitAndInsert(content: DocumentFragment, range: Range) {
  const firstEl = content.firstElementChild!;

  // If we only have one node in our content, and it's not a list or card, we'll
  // inline it into the current selection.
  if (content.children.length === 1 && !Dom.isCard(firstEl) && !Dom.isList(firstEl)) {
    range.insertNode(Dom.toFragment(firstEl.childNodes));
    return range;
  }

  return Rng.$splitAndInsert(Dom.findLeaf, range, content);
}

/**
 * Merge the specified list into the range. The range is assumed to be within
 * an existing list.
 */
function mergeLists(list: Element, range: Range, frag: DocumentFragment) {
  const firstLi = list.firstElementChild;
  const lastLi = last(list.querySelectorAll('li'))!;
  const li = Dom.closest('li', Rng.toNode(range));

  if (!firstLi || !li) {
    return insertBelow(frag, Dom.findLeaf(Rng.toNode(range))!);
  }

  list.remove();

  const pastedSublist = firstLi.querySelector('ol,ul');
  const existingSublist = li?.querySelector('ol,ul');

  firstLi.remove();
  pastedSublist?.remove();

  range.insertNode(Dom.toFragment(firstLi.childNodes));
  range.collapse();
  range.setEndAfter(li);

  const trailingLi = range.extractContents().firstElementChild;

  if (pastedSublist) {
    li.append(pastedSublist);
  }

  if (existingSublist && pastedSublist) {
    existingSublist.remove();
    pastedSublist.append(Dom.toFragment(existingSublist.childNodes));
  }

  if (list.childNodes.length) {
    Dom.insertAfter(Dom.toFragment(list.childNodes), li);
  }

  range.selectNodeContents(lastLi);

  if (trailingLi && !Dom.isEmpty(trailingLi)) {
    if (lastLi !== firstLi) {
      lastLi.append(Dom.toFragment(trailingLi.childNodes));
    } else {
      Dom.insertAfter(trailingLi, li);
      range.setStart(trailingLi, 0);
    }
  }

  if (frag.children.length) {
    return insertBelow(frag, Dom.findLeaf(li)!);
  }

  return range;
}

/**
 * Decision table:
 * | Target leaf  | First node  | Action
 * |----------------------------------------------------
 * | immutable    | *           | insert below
 * | empty        | *           | replace with first element
 * | list         | list        | merge lists
 * | non-list     | non-list    | split and insert, with intelligent merge of start / end content
 */
function insertLeafs(content: DocumentFragment, range: Range, editor: MinidocBase & Mountable) {
  const newLeafs = editor.beforeMount(content);
  const targetLeaf = Dom.findLeaf(Rng.currentNode()!);
  const firstNode = newLeafs.children[0];

  if (!firstNode) {
    return range;
  }
  if (!targetLeaf) {
    editor.root.append(content);
    const lastElementChild = editor.root.lastElementChild;
    return lastElementChild ? Rng.fromNodes([lastElementChild]) : range;
  }
  if (Dom.isImmutable(targetLeaf)) {
    return insertBelow(newLeafs, targetLeaf);
  } else if (Dom.isEmpty(targetLeaf)) {
    const result = insertBelow(newLeafs, targetLeaf);
    targetLeaf.remove();
    return result;
  } else if (Dom.isList(targetLeaf) && Dom.isList(firstNode)) {
    return mergeLists(firstNode, range, newLeafs);
  } else {
    return splitAndInsert(newLeafs, range);
  }
}

/**
 * Add support for clipboard to minidoc.
 */
export const clipbordMiddleware = inferMiddleware((next, b) => {
  const el = b.root;
  const editor = b as MinidocBase & Changeable & Mountable & Scrubbable;

  Dom.on(el, 'paste', (e) => {
    if (e.defaultPrevented) {
      return;
    }
    e.preventDefault();
    const range = Rng.currentRange()!;
    !range.collapsed && Rng.$deleteAndMergeContents(range);

    const content = convertToLeafs(readClipboard(e, editor));
    if (!content) {
      return;
    }

    editor.captureChange(() => {
      const result = insertLeafs(content, range, editor);
      result.collapse();
      Rng.setCurrentSelection(result);
    });
  });

  Dom.on(el, 'copy', (e) => {
    moveToClipboard(e, false);
  });

  Dom.on(el, 'cut', (e) => {
    editor.captureChange(() => moveToClipboard(e, true));
  });

  return next(editor);
});

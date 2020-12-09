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
import { h } from '../dom';
import { last } from '../util';
import { scrubHtml } from './scrub-html';

function stripBrs(el: Element) {
  Array.from(el.querySelectorAll('br')).forEach((n) => n.remove());
  return el;
}

function readClipboard(e: ClipboardEvent): DocumentFragment | undefined {
  const { clipboardData } = e;

  if (!clipboardData) {
    return;
  }

  const rawHtml = clipboardData.getData('text/html');
  if (rawHtml) {
    return scrubHtml(rawHtml);
  }

  const text = clipboardData.getData('text/plain');
  if (text) {
    return Dom.toFragment(text);
  }
}

/**
 * Convert the specified document fragment into Elements that are
 * valid as document leaf nodes.
 */
function convertToLeafs(frag: DocumentFragment | undefined) {
  if (!frag) {
    return;
  }

  let leaf: Node | undefined;

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
  Array.from(frag.children).forEach((n) => {
    stripBrs(n);
    Dom.isEmpty(n) && n.remove();
  });

  return frag;
}

function extractCopyContent(range: Range, isCut: boolean) {
  const startLeaf = Dom.findLeaf(Rng.toNode(range));
  const endLeaf = Dom.findLeaf(Rng.toEndNode(range));

  // Handle the special case where we're copying a single card
  if (startLeaf && range.collapsed && Dom.isImmutable(startLeaf)) {
    isCut && startLeaf.remove();
    return Dom.toFragment(startLeaf.cloneNode(false));
  }

  const content = isCut ? Rng.$deleteAndMergeContents(range) : range.cloneContents();

  if (startLeaf !== endLeaf || !Dom.isList(startLeaf)) {
    return content;
  }

  // We're copying lis, so we need to make sure the clipboard contains a valid list (e.g. ol/ul)
  // This can happen when we've selected just the text of an li and it has a sublist
  const listContent =
    !Dom.isElement(content?.firstChild) || !content?.firstChild.matches('li')
      ? h('li', content)
      : content;
  return Dom.toFragment(h(startLeaf.tagName, listContent));
}

function moveToClipboard(e: ClipboardEvent, isCut: boolean) {
  e.preventDefault();
  const dataTransfer = e.clipboardData;
  const range = Rng.currentRange();

  if (!dataTransfer || !range) {
    return;
  }

  const content = extractCopyContent(range, isCut);
  content && dataTransfer.setData('text/html', Dom.toHTML(content));
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

  if (trailingLi && !Dom.isEmpty(trailingLi, true)) {
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
function insertLeafs(content: DocumentFragment, range: Range, editor: MinidocCoreEditor) {
  const newLeafs = editor.beforeMount(content);
  const targetLeaf = Dom.findLeaf(Rng.currentNode()!);
  const firstNode = newLeafs.children[0];

  if (!firstNode || !targetLeaf) {
    return range;
  }

  if (Dom.isImmutable(targetLeaf)) {
    return insertBelow(newLeafs, targetLeaf);
  } else if (Dom.isEmpty(targetLeaf, true)) {
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
export const clipboardPlugin: MinidocPlugin = (editor) => {
  Dom.on(editor.root, 'paste', (e) => {
    e.preventDefault();
    const range = Rng.currentRange()!;
    !range.collapsed && Rng.$deleteAndMergeContents(range);

    const content = convertToLeafs(readClipboard(e));
    if (!content) {
      return;
    }

    const result = insertLeafs(content, range, editor);
    result.collapse();
    Rng.setCurrentSelection(result);
  });

  Dom.on(editor.root, 'copy', (e) => {
    editor.root.normalize();
    moveToClipboard(e, false);
  });

  Dom.on(editor.root, 'cut', (e) => {
    editor.root.normalize();
    moveToClipboard(e, true);
  });

  return editor;
};

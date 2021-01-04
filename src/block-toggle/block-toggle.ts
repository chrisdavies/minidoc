/**
 * This module adds the ability to toggle block-level elements (e.g. h1, p, etc).
 * Unfortunately, this needs to special case cards and lists, even though those
 * belong largely to other modules.
 */
import * as Rng from '../range';
import * as Dom from '../dom';
import { h } from '../dom';
import { EditorMiddlewareMixin, MinidocBase } from '../types';
import { Changeable } from '../undo-redo';

export interface BlockTogglable {
  toggleBlock(tagName: string): void;
}

function toggleBlock(tagName: string, range: Range) {
  const leafs = Rng.findLeafs(range);
  const allMatch = leafs.every((el) => el.matches(tagName));
  const blockType = allMatch ? 'p' : tagName;
  const newLeafs: Element[] = [];

  leafs.forEach((el) => {
    // We don't allow toggling immutable leafs such as mindoc cards.
    if (Dom.isImmutable(el)) {
      return;
    }
    if (el.matches('ul,ol')) {
      const frag = document.createDocumentFragment();
      Array.from(el.querySelectorAll('li')).forEach((li) => {
        const child = h(blockType, li.childNodes);
        Array.from(child.querySelectorAll('ol,li')).forEach((n) => n.remove());
        frag.appendChild(child);
        newLeafs.push(child);
      });
      el.replaceWith(frag);
    } else {
      const child = h(blockType, el.childNodes);
      newLeafs.push(child);
      el.replaceWith(child);
    }
  });

  return Rng.fromNodes(newLeafs);
}

export const blockTogglable: EditorMiddlewareMixin<BlockTogglable> = (next, editor) => {
  const result = editor as MinidocBase & BlockTogglable & Changeable;
  result.toggleBlock = (tagName) => {
    const range = Rng.currentRange();
    range && result.captureChange(() => Rng.setCurrentSelection(toggleBlock(tagName, range)));
  };
  return next(result);
};

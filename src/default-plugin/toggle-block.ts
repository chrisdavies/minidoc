import * as Rng from '../range';
import * as Dom from '../dom';
import { h } from '../dom';

export function toggleBlock(tagName: string, range: Range) {
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

  Rng.setCurrentSelection(Rng.fromNodes(newLeafs));
}

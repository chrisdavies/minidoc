import * as Dom from '../dom';
import * as Rng from '../range';
import { h } from '../dom';

function convertToParagraphs(leafs: Element[], range: Range) {
  const frag = document.createDocumentFragment();
  leafs.forEach((leaf) => {
    leaf.remove();
    leaf.querySelectorAll('li').forEach((li) => {
      Array.from(li.querySelectorAll('ol,ul')).forEach((l) => l.remove());
      frag.appendChild(h('p', li.childNodes));
    });
  });
  const children = Array.from(frag.childNodes);
  range.insertNode(frag);
  return Rng.fromNodes(children);
}

function convertToList(tagName: string, leafs: Element[], range: Range) {
  const list = h(tagName);
  leafs.forEach((leaf) => {
    leaf.remove();
    // If it's not a list, we just need to convert it to an li
    if (!Dom.isList(leaf)) {
      list.appendChild(h('li', leaf.childNodes));
      return;
    }
    // It's a list, so we need to convert all child lists to the correct type
    Array.from(leaf.querySelectorAll('ol,ul')).forEach((child) => {
      child.replaceWith(h(tagName, child.childNodes));
    });
    // Finally, we move all the lis from the list to the leaf
    Array.from(leaf.children).forEach((li) => list.appendChild(li));
  });
  range.insertNode(list);
  Rng.$copy(range, Rng.fromNodes(list.children));
  return range;
}

export function toggleList(tagName: string, range: Range) {
  const leafs = Rng.findLeafs(range);
  const allMatch = leafs.every((l) => l.matches(tagName));
  // If all leafs match the tag (e.g. ol / ul), then we are
  // removing the list. We convert all lis into ps and flatten them.
  if (allMatch) {
    return convertToParagraphs(leafs, range);
  } else {
    return convertToList(tagName, leafs, range);
  }
}

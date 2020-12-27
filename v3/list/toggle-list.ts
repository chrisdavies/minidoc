import * as Dom from '../dom';
import * as Rng from '../range';
import { h } from '../dom';

function convertToParagraphs(leafs: Element[]) {
  const frag = document.createDocumentFragment();
  leafs.forEach((leaf) => {
    leaf.remove();
    if (Dom.isImmutable(leaf)) {
      frag.appendChild(leaf);
    } else {
      leaf.querySelectorAll('li').forEach((li) => {
        Array.from(li.querySelectorAll('ol,ul')).forEach((l) => l.remove());
        frag.appendChild(h('p', li.childNodes));
      });
    }
  });
  return frag;
}

function convertToList(tagName: string, leafs: Element[]) {
  const frag = document.createDocumentFragment();
  let list = h(tagName);
  leafs.forEach((leaf) => {
    leaf.remove();
    if (Dom.isImmutable(leaf)) {
      frag.appendChild(leaf);
      list = h(tagName);
    } else if (Dom.isList(leaf)) {
      leaf.querySelectorAll('li').forEach((li) => {
        Array.from(li.querySelectorAll('ol,ul')).forEach((l) =>
          l.replaceWith(h(tagName, l.children)),
        );
        list.appendChild(li);
      });
    } else {
      list.appendChild(h('li', leaf.childNodes));
    }
    if (list.hasChildNodes()) {
      frag.appendChild(list);
    }
  });
  return frag;
}

export function toggleList(tagName: string, range: Range) {
  const leafs = Rng.findLeafs(range);
  const allMatch = leafs.every((l) => Dom.isImmutable(l) || l.matches(tagName));
  // If all leafs match the tag (e.g. ol / ul), then we are
  // removing the list. We convert all lis into ps and flatten them.
  const frag = allMatch ? convertToParagraphs(leafs) : convertToList(tagName, leafs);
  const children = allMatch ? Array.from(frag.childNodes) : Array.from(frag.querySelectorAll('li'));
  range.insertNode(frag);
  return Rng.fromNodes(children);
}

import * as Dom from '../dom';
import * as Rng from '../range';
import { h } from '../dom';

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
  const list = Dom.toElement(range.commonAncestorContainer)?.closest('ol,ul');
  const parentLi = Dom.toElement(range.commonAncestorContainer)?.closest('li');
  const leaf = list && Dom.findLeaf(list);

  // Our selection is already the specified list type. We'll convert the entire
  // list (not just our selection) to paragraphs.
  if (leaf && list?.matches(tagName)) {
    const nodes: Node[] = [];
    list.querySelectorAll('li').forEach((li) => {
      const extract = Rng.fromNodes([li]);
      const sublist = li.querySelector('ol,ul');
      sublist && extract.setEndBefore(sublist);
      nodes.push(h('p', extract.extractContents()));
    });

    const tail = Rng.createRange();
    tail.setStartAfter(parentLi || list);
    tail.setEndAfter(leaf);
    const tailContent = tail.extractContents();
    const frag = Dom.toFragment(nodes);
    if (!Dom.isEmpty(tailContent)) {
      frag.append(tailContent);
    }
    leaf.parentElement?.insertBefore(frag, leaf.nextSibling);
    list.remove();
    return Rng.fromNodes(nodes);
  }

  // Our selection is a list, but not of the specified type. We'll convert the
  // entire list to the specified type.
  if (list) {
    const newList = h(tagName, list.childNodes);
    list.replaceWith(newList);
    const result = Rng.createRange();
    result.selectNodeContents(newList.lastElementChild || newList);
    result.setStart(newList.firstElementChild || newList, 0);
    return result;
  }

  // Our selection is not a list, so we'll convert it to one
  const frag = convertToList(tagName, Rng.findLeafs(range));
  const children = Array.from(frag.querySelectorAll('li'));
  range.insertNode(frag);
  return Rng.fromNodes(children);
}

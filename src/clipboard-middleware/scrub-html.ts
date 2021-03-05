import * as Dom from '../dom';
import * as Rng from '../range';
import { h } from '../dom';

const isSafeUrl = (s?: string) => !s?.startsWith('javascript:');

const allowableTags = new Set([
  'P',
  'DIV',
  'FIGURE',
  'FIGCAPTION',
  'VIDEO',
  'IMG',
  'A',
  'I',
  'B',
  'STRONG',
  'EM',
  'BLOCKQUOTE',
  'H1',
  'H2',
  'H3',
  'H4',
  'UL',
  'OL',
  'LI',
  'HR',
  'MINI-CARD',
]);

const allowableAttributes: { [k: string]: { [k: string]: (val?: string) => boolean } } = {
  IMG: {
    src: isSafeUrl,
  },
  VIDEO: {
    src: isSafeUrl,
  },
  A: {
    href: isSafeUrl,
  },
  'MINI-CARD': {
    state: () => true,
    type: () => true,
  },
};

function isAllowableAttribute(el: Element, attr: string) {
  const attrs = allowableAttributes[el.tagName];
  const check = attrs && attrs[attr];
  return check && check(el.getAttribute(attr) || undefined);
}

/**
 * Converts the specified html into an array of elements which have been sanitized.
 * @param {string} html
 */
export function scrubHtml(html: string) {
  const result = Rng.fromNodes([h('div', { innerHTML: html })]).extractContents();

  function scrub(el: Node) {
    if (Dom.isText(el)) {
      return;
    }
    if (!Dom.isElement(el) || !allowableTags.has(el.tagName)) {
      el.parentNode?.removeChild(el);
      return;
    }
    el.getAttributeNames().forEach((a) => {
      if (!isAllowableAttribute(el, a)) {
        el.removeAttribute(a);
      }
    });
    if (el.tagName === 'MINI-CARD') {
      el.innerHTML = '';
      return;
    }
    const children = el.childNodes;
    if (children && children.length) {
      Array.from(children).forEach(scrub);
    }
  }

  Array.from(result.childNodes).forEach(scrub);
  return result;
}

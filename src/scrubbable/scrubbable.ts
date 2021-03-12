import * as Dom from '../dom';
import { EditorMiddlewareMixin, MinidocBase } from '../types';

export interface Scrubbable {
  scrub<T extends Node>(content: T): T;
}

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
  'BR',
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

export const scrubbableMiddleware: EditorMiddlewareMixin<Scrubbable> = (next, editor) => {
  const result = editor as MinidocBase & Scrubbable;

  result.scrub = (content) => {
    function scrub(node: Node) {
      node.childNodes.forEach((el) => {
        if (!Dom.isElement(el) || Dom.isImmutable(el)) {
          return;
        }
        if (!allowableTags.has(el.tagName)) {
          el.remove();
          return;
        }
        el.getAttributeNames().forEach((a) => {
          if (!isAllowableAttribute(el, a)) {
            el.removeAttribute(a);
          }
        });
        const children = el.childNodes;
        if (children && children.length) {
          Array.from(children).forEach(scrub);
        }
      });
    }

    scrub(content);

    return content;
  };

  return next(result);
};

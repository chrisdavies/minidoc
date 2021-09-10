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
  'MARK',
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
  MARK: {
    'data-bg': () => true,
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

type Scrubber = (node: Node, baseScrub: (node: Node) => void, editor: MinidocBase) => void;

const defaultScrubber: Scrubber = (node, baseScrub) => baseScrub(node);

export const scrubbableMiddleware =
  (scrubber: Scrubber = defaultScrubber): EditorMiddlewareMixin<Scrubbable> =>
  (next, editor) => {
    const result = editor as MinidocBase & Scrubbable;

    result.scrub = (content) => {
      function scrub(node: Node) {
        Array.from(node.childNodes).forEach((el) => {
          if (!Dom.isElement(el) || Dom.isImmutable(el)) {
            return;
          }
          if (!allowableTags.has(el.tagName)) {
            const frag = Dom.toFragment(el.childNodes);
            scrub(frag);
            el.replaceWith(frag);
            return;
          }
          el.getAttributeNames().forEach((a) => {
            if (!isAllowableAttribute(el, a)) {
              el.removeAttribute(a);
            }
          });
          const children = el.childNodes;
          if (children && children.length) {
            scrub(el);
          }
        });
      }

      scrubber(content, scrub, result);

      return content;
    };

    return next(result);
  };

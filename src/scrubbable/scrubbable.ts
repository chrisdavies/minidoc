import * as Dom from '../dom';
import { EditorMiddlewareMixin, MinidocBase } from '../types';

export interface Scrubbable {
  scrub<T extends Node>(content: T): T;
}

type AttrRules = Record<string, boolean | ((val?: string) => boolean)>;
type ScrubbableRules = Record<string, AttrRules>;
type Scrubber = (node: Node, editor: MinidocBase) => void;

const isSafeUrl = (s?: string) => !s?.startsWith('javascript:');

export const rules: ScrubbableRules = {
  P: {},
  DIV: {},
  FIGURE: {},
  FIGCAPTION: {},
  VIDEO: { src: isSafeUrl },
  IMG: { src: isSafeUrl },
  A: { href: isSafeUrl },
  I: {},
  B: {},
  STRONG: {},
  EM: {},
  BLOCKQUOTE: {},
  H1: {},
  H2: {},
  H3: {},
  H4: {},
  UL: {},
  OL: {},
  LI: {},
  HR: {},
  BR: {},
  MARK: { 'data-bg': true },
  'MINI-CARD': { state: true, type: true },
};

export const createScrubber = (scrubbableRules: ScrubbableRules): Scrubber => {
  return function scrub(node: Node) {
    Array.from(node.childNodes).forEach((el) => {
      if (!Dom.isElement(el) || Dom.isImmutable(el)) {
        return;
      }
      const attrRules = scrubbableRules[el.tagName];
      if (!attrRules) {
        const frag = Dom.toFragment(el.childNodes);
        scrub(frag);
        el.replaceWith(frag);
        return;
      }
      el.getAttributeNames().forEach((a) => {
        const isAllowable = attrRules[a];
        if (
          !isAllowable ||
          (typeof isAllowable === 'function' && !isAllowable(el.getAttribute(a) || undefined))
        ) {
          el.removeAttribute(a);
        }
      });
      const children = el.childNodes;
      if (children && children.length) {
        scrub(el);
      }
    });
  };
};

export const middleware =
  (scrubber: Scrubber = createScrubber(rules)): EditorMiddlewareMixin<Scrubbable> =>
  (next, editor) => {
    const result = editor as MinidocBase & Scrubbable;

    result.scrub = (content) => {
      scrubber(content, result);
      return content;
    };

    return next(result);
  };

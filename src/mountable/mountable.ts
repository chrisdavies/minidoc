import * as Dom from '../dom';
import { isElement, newLeaf } from '../dom';
import { EditorMiddlewareMixin, MinidocBase } from '../types';

export interface Mountable {
  beforeMount<T extends Node>(node: T): T;
}

export const mountable: EditorMiddlewareMixin<Mountable> = (next, editor) => {
  const result = editor as MinidocBase & Mountable;

  result.beforeMount = (x) => {
    // Sanitize the editor root. Vanilla text nodes are not allowed as leafs.
    Array.from(x.childNodes).forEach((n) => !Dom.isElement(n) && n.remove());
    // Ensure the editor root has at least one editable element in it.
    const firstChild = x.firstChild;
    if (isElement(firstChild)) {
      Dom.$makeEditable(firstChild);
    } else {
      x.appendChild(newLeaf());
    }
    return x;
  };

  return next(result);
};

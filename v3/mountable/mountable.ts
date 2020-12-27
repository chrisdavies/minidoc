import * as Dom from '../dom';
import { EditorMiddlewareMixin, MinidocBase } from '../types';

export interface Mountable {
  beforeMount: typeof beforeMount;
}

function beforeMount<T extends ParentNode & Node>(x: T): T {
  // Sanitize the editor root. Vanilla text nodes are not allowed as leafs.
  Array.from(x.childNodes).forEach((n) => !Dom.isElement(n) && n.remove());
  // Ensure the editor root has at least one editable element in it.
  Dom.$makeEditable(x);
  return x;
}

export const mountable: EditorMiddlewareMixin<Mountable> = (next, editor) => {
  const result = editor as MinidocBase & Mountable;
  const el = editor.root;

  result.beforeMount = beforeMount;
  beforeMount(el);

  return next(result);
};

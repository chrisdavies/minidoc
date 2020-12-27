import { EditorMiddlewareMixin, MinidocBase } from '../types';

export interface Serializable {
  serialize(): string;
}

function isSerializable(n: any): n is Serializable {
  return n.serialize;
}

export const serializable: EditorMiddlewareMixin<Serializable> = (next, editor) => {
  const result = editor as MinidocBase & Serializable;
  const el = editor.root;

  result.serialize = () =>
    Array.from(el.children)
      .map((n) => (isSerializable(n) ? n.serialize() : n.outerHTML))
      .join('');

  return next(result);
};

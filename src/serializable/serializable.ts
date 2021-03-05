import { EditorMiddlewareMixin, MinidocBase } from '../types';

export interface Serializable {
  serialize(forSave?: boolean): string;
}

function isSerializable(n: any): n is Serializable {
  return n.serialize;
}

export const serializable: EditorMiddlewareMixin<Serializable> = (next, editor) => {
  const result = editor as MinidocBase & Serializable;
  const el = editor.root;

  result.serialize = (forSave = true) =>
    Array.from(el.children)
      .map((n) =>
        isSerializable(n)
          ? // Use custom serialization if the element has specified it
            n.serialize(forSave)
          : // Use outerHTML, but remove any empty tags <foo></foo>
            n.outerHTML.replace(/<([a-z\-]+)><\/([a-z\-]+)>/g, (a, b, c) => (b === c ? '' : a)),
      )
      .join('');

  return next(result);
};

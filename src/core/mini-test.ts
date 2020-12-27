import { minidoc } from './minidoc';
import { MinidocBase, EditorMiddlewareMixin } from '../minidoc-types';
import { placeholderable } from './placeholderable';

interface Barable {
  bar: number;
}

const barPlugin: EditorMiddlewareMixin<Barable> = (next, editor) => {
  const result = editor as MinidocBase & Barable;
  result.bar = 33;
  return next(result);
};

interface Bazable {
  baz: string;
}

const bazPlugin: EditorMiddlewareMixin<Bazable> = (next, editor) => {
  const result = editor as MinidocBase & Bazable;
  result.baz = 'gold';
  return next(result);
};

const yyy = minidoc({ doc: '', middleware: [barPlugin, bazPlugin, placeholderable('foo')] });
console.log(yyy.baz, yyy.bing);

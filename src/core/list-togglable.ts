import * as Rng from '../range';
import { EditorMiddlewareMixin, MinidocBase } from '../minidoc-types';
import { toggleList } from '../list';
import { Changeable } from './undoredo';

export interface ListTogglable {
  toggleList(tagName: string): void;
}

export const listTogglable: EditorMiddlewareMixin<ListTogglable> = (next, editor) => {
  const result = editor as MinidocBase & ListTogglable & Changeable;
  result.toggleList = (tagName) => {
    const range = Rng.currentRange();
    range && result.captureChange(() => toggleList(tagName, range));
  };
  return next(result);
};

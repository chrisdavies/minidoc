/**
 * This plugin handles the editor behavior for text alignment.
 */

import * as Rng from '../range';
import * as Dom from '../dom';
import { EditorMiddleware, MinidocBase } from '../types';
import { Changeable } from '../undo-redo';

export interface Alignable {
  align(direction: 'left' | 'center' | 'right'): void;
}

function align(direction: string) {
  const range = Rng.currentRange();
  if (!range) {
    return;
  }
  const leafs = Rng.findLeafs(range);
  const attr = 'data-align';
  leafs.forEach((el) =>
    direction === 'left' ? el.removeAttribute(attr) : el.setAttribute(attr, direction),
  );
}

export const alignMixin: EditorMiddleware<Alignable> = (next, editor) => {
  const result = editor as MinidocBase & Alignable & Changeable;
  result.align = (direction) => {
    result.captureChange(() => align(direction));
    result.root.isConnected && Dom.emit(result.root, 'mini:caretchange');
  };
  return next(result);
};

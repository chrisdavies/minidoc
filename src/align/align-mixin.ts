/**
 * This plugin handles the editor behavior for text alignment.
 */

import * as Dom from '../dom';
import { EditorMiddleware, MinidocBase } from '../types';
import { Changeable } from '../undo-redo';
import { align } from './align-menu';

export interface Alignable {
  align(direction: 'left' | 'center' | 'right'): void;
}

export const alignMixin: EditorMiddleware<Alignable> = (next, editor) => {
  const result = editor as MinidocBase & Alignable & Changeable;
  result.align = (direction) => {
    align(direction);
    result.root.isConnected && Dom.emit(result.root, 'mini:caretchange');
  };
  return next(result);
};

import { EditorMiddleware, MinidocBase } from '../types';
import { Disposable, initialize } from '../disposable';
import * as Dom from '../dom';

/**
 * Mixin that converts the editor to a disposable interface.
 */
export const disposable: EditorMiddleware<Disposable> = (next, editor) => {
  const result = editor as MinidocBase & Disposable;
  const el = editor.root;
  result.dispose = initialize(el, () => Dom.emit(el, 'mini:change')).dispose;
  return next(result);
};

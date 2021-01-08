/**
 * When the editor's caret position changes, we will fire off a mini:caretchange event.
 */
import * as Dom from '../dom';
import { EditorMiddleware, MinidocBase } from '../types';

export const selectionTracker: EditorMiddleware = (next, editor: MinidocBase) => {
  const el = editor.root;

  // Disable selection change tracking.
  let off: (() => void) | undefined;

  // When the selection changes within the element,
  // we'll fire off a selection change event.
  Dom.on(el, 'focus', (e) => {
    if (!off) {
      off = Dom.on(document, 'selectionchange', (e) => Dom.emit(el, 'mini:caretchange', e));
      // The setTimeout ensures the range / selection has moved into the element before we fire
      // off mini:caretchange.
      setTimeout(() => Dom.emit(el, 'mini:caretchange', e));
    }
  });

  Dom.on(el, 'blur', () => {
    off?.();
    off = undefined;
  });

  return next(editor);
};

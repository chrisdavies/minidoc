/**
 * When the editor's caret position changes, we will fire off a mini:caretchange event.
 */
import * as Dom from '../dom';
import { EditorMiddleware, MinidocBase } from '../minidoc-types';

export const selectionTracker: EditorMiddleware = (next, editor: MinidocBase) => {
  const el = editor.root;

  // Disable selection change tracking.
  let off: (() => void) | undefined;

  // When the selection changes within the element,
  // we'll fire off a selection change event.
  Dom.on(el, 'focus', () => {
    if (!off) {
      off = Dom.on(document, 'selectionchange', (e) => Dom.emit(el, 'mini:caretchange', e));
    }
  });

  Dom.on(el, 'blur', () => {
    off?.();
    off = undefined;
  });

  return next(editor);
};

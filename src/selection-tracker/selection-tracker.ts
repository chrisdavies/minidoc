/**
 * When the editor's caret position changes, we will fire off a mini:caretchange event.
 */
import * as Dom from '../dom';
import * as Rng from '../range';
import { EditorMiddleware, MinidocBase } from '../types';

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

  /**
   * The default browser triple-click results in selecting not only the clicked
   * element, but also the very start of the following element. This causes bugs
   * when toggling blocks (and probably other cases).
   */
  Dom.on(el, 'click', (e) => {
    if (e.detail === 3) {
      e.preventDefault();
      const leaf = Dom.findLeaf(Rng.currentNode()!)!;
      const range = Rng.createRange();
      range.selectNodeContents(leaf);
      Rng.setCurrentSelection(range);
    }
  });

  return next(editor);
};

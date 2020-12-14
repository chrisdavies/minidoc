/**
 * This module tracks the caret position as the user makes edits. When the user
 * performs an undo / redo operation, they expect the caret to return to its
 * previous / next position. This is often not the position the caret was in
 * when we captured the undo / redo snapshot, but rather the last position
 * the caret was in before we start the next undo / redo capture cycle.
 * To track this, we need to capture the detached range every time the selection
 * changes. I'd love to come up with a more efficent way to pull this off, but
 * for now, this is the simplest correct solution I can think of.
 */
import * as Rng from '../range';
import * as Dom from '../dom';

export function caretTracker(editor: MinidocEditor) {
  let isTracking = true;
  let isApplyingHistory = false;

  // We wrap the editor's undo / redo so we can ignore any edit
  // events that arise as a result of undo / redo operations.
  const trackUndoRedo = (fn: () => void) => () => {
    isApplyingHistory = true;
    try {
      fn();
    } finally {
      setTimeout(() => (isApplyingHistory = false));
    }
  };

  editor.undo = trackUndoRedo(editor.undo);
  editor.redo = trackUndoRedo(editor.redo);

  // When the editor's content changes, assuming it's not
  // an undo / redo, we need to stop tracking the caret
  // until the undo / redo system captures the history state.
  editor.on('edit', () => {
    if (!isApplyingHistory) {
      isTracking = false;
    }
  });

  // When the undo system has captured / committed the state to history,
  // we are in a clean undo / redo state, and can resume tracking the caret.
  editor.on('undocapture', () => {
    isTracking = true;
  });

  editor.on('caretchange', () => {
    if (isTracking) {
      const range = Rng.detachFrom(Rng.currentRange(), editor.root);
      range && editor.undoHistory.setContext(range);
    }
  });
}

export function trackSelectionChange(el: Element, handler: () => void) {
  // Disable selection change tracking.
  let off: (() => void) | undefined;

  // When the selection changes within the element,
  // we'll fire off a selection change event.
  Dom.on(el, 'focus', () => {
    if (!off) {
      off = Dom.on(document, 'selectionchange', handler);
    }
  });

  Dom.on(el, 'blur', () => {
    off?.();
    off = undefined;
  });
}

/**
 * Adds undo / redo to the editor. This module unfortunately needs to be
 * aware of serialization, cards, and element mounting mixins.
 *
 * This module tracks the caret position as the user makes edits. When the user
 * performs an undo / redo operation, they expect the caret to return to its
 * previous / next position. This is often not the position the caret was in
 * when we captured the undo / redo snapshot, but rather the last position
 * the caret was in before we start the next undo / redo capture cycle.
 * To track this, we need to capture the detached range every time the selection
 * changes. I'd love to come up with a more efficent way to pull this off, but
 * for now, this is the simplest correct solution I can think of.
 */

import * as Dom from '../dom';
import * as Rng from '../range';
import { makeUndoRedo, UndoRedo } from './undo-redo';
import { EditorMiddleware, MinidocBase } from '../types';
import { UndoHistoryState } from './types';
import { Serializable } from '../serializable';
import { Mountable } from '../mountable';

export interface Undoable {
  undo(): void;
}

export interface Redoable {
  redo(): void;
}

export interface Changeable {
  /**
   * Notify the undo / redo system of a change. This notification
   * is buffered and won't be captured until a timeout has passed.
   */
  onChange(): void;
  /**
   * Capture an atomic change in the undo / redo system. The callback
   * fn is responsible for making the change.
   */
  captureChange(fn: () => void): void;
}

function init(
  editor: MinidocBase & Undoable & Redoable & Changeable & Serializable,
  externalUndoRedo?: UndoRedo,
) {
  const el = editor.root;

  // If the caret changes as a result of an undo / redo, we ignore it.
  let isApplyingHistory = false;
  const undoRedo = externalUndoRedo || makeUndoRedo();
  const id = editor.id || 'minidoc';
  const initialState: UndoHistoryState = {
    doc: editor.serialize(false),
    range: el.children.length ? { start: [0, 0] } : Rng.emptyDetachedRange(),
  };

  undoRedo.registerProvider({
    id,
    currentState: initialState,
    setState(state: UndoHistoryState) {
      isApplyingHistory = true;
      // TODO: Videos flicker in Safari given a totally naive (replace the entire doc)
      // undo / redo mechanism. So instead, we need to attempt to keep the existing cards in the DOM.
      editor.root.innerHTML = state.doc;
      const range = Rng.attachTo(state.range, editor.root);
      range && Rng.setCurrentSelection(range);

      el.focus();
    },
  });

  const onChange = () => {
    if (isApplyingHistory) {
      return;
    }
    undoRedo.push({
      id,
      getValue(): UndoHistoryState {
        const range = Rng.currentRange();
        return {
          doc: editor.serialize(false),
          range: (range && Rng.detachFrom(range, el)) || Rng.emptyDetachedRange(),
        };
      },
    });
  };

  editor.undo = undoRedo.undo;
  editor.redo = undoRedo.redo;

  editor.captureChange = (fn) => {
    fn();
    onChange();
  };

  editor.onChange = onChange;

  // Override the undo / redo shortcuts, as we need to customize history.
  Dom.on(el, 'keydown', (e) => {
    if (!e.ctrlKey && !e.metaKey) {
      return;
    }
    if (e.code === 'KeyY' || (e.shiftKey && e.code === 'KeyZ')) {
      e.preventDefault();
      editor.redo();
    } else if (e.code === 'KeyZ') {
      e.preventDefault();
      editor.undo();
    }
  });

  Dom.on(el, 'mini:change', () => {
    // When the editor's content changes, assuming it's not
    // an undo / redo, we need to stop tracking the caret
    // until the undo / redo system captures the history state.
    // If we kept tracking the caret, we'd log invalid caret
    // positions in history.
    if (isApplyingHistory) {
      isApplyingHistory = false;
      return;
    }

    onChange();
  });
}

/**
 * Mixin that converts the editor to a disposable interface.
 */
export const makeUndoRedoMiddleware =
  (undoRedo?: UndoRedo): EditorMiddleware<Undoable & Redoable & Changeable> =>
  (next, editor) => {
    const result = next(
      editor as MinidocBase & Undoable & Redoable & Changeable & Mountable & Serializable,
    );

    // We have to initialize undo / redo only after the doc has been mounted. Prior to this,
    // the doc may be in an intermadiate / initializing state. The setTimeout is to put our
    // initialization after any DOM change events have propagated.
    setTimeout(() => init(result, undoRedo));

    return result;
  };

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
import { makeUndoRedo } from './undo-redo';
import { EditorMiddleware, MinidocBase } from '../types';
import { Mountable } from '../mountable';
import type { Serializable } from '../minidoc/core-mixin';

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
}

function init(editor: MinidocBase & Undoable & Redoable & Changeable & Serializable) {
  const el = editor.root;

  // If the caret changes as a result of an undo / redo, we ignore it.
  const undoRedo = makeUndoRedo({ initialState: editor.state, setState: editor.setState });

  const onChange = () => undoRedo.push(editor.state);

  editor.undo = undoRedo.undo;

  editor.redo = undoRedo.redo;

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

  Dom.on(el, 'mini:change', onChange);
}

/**
 * Mixin that adds undo / redo to the editor. This can be overridden by adding
 * it more than once in the mixins list. The last one wins.
 */
export const makeUndoRedoMiddleware =
  (opts?: { disabled?: boolean }): EditorMiddleware<Undoable & Redoable & Changeable> =>
  (next, editor) => {
    const result = next(
      editor as MinidocBase & Undoable & Redoable & Changeable & Mountable & Serializable,
    );

    // This is a hack that allows us to disable the base / default plugin
    // instance with a subsequent undo / redo plugin.
    const initialized = result as unknown as { $hasUndo: boolean };
    if (initialized.$hasUndo) {
      return result;
    }
    initialized.$hasUndo = true;

    if (opts?.disabled) {
      // Set up the undo / redo functions as noops / pass-throughs
      result.undo = () => {};
      result.redo = () => {};
      result.onChange = () => {};
    } else {
      // We have to initialize undo / redo only after the doc has been mounted. Prior to this,
      // the doc may be in an intermadiate / initializing state. The setTimeout is to put our
      // initialization after any DOM change events have propagated.
      setTimeout(() => init(result));
    }

    return result;
  };

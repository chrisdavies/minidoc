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
import { h } from '../dom';
import { undoRedo } from './undo-redo';
import { EditorMiddlewareMixin, MinidocBase } from '../types';
import { UndoHistoryState, DetachedRange } from './types';
import { Serializable } from '../serializable';
import { Mountable } from '../mountable';
import { Scrubbable } from '../scrubbable';

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

/**
 * Replace the editor's document with the one provided by the undo / redo system.
 *
 * Videos flicker in Safari given a totally naive (replace the entire doc) undo / redo mechanism.
 * So instead, we here attempt to keep the existing cards in the DOM. This is done with a very
 * simple, linear comparison. We consider two cards to be compatible if they have the same state
 * and type. If any cards are moved / modified / added, etc, the flicker will occur for that
 * particular undo frame, but not for the typical typing and undoing of typing.
 */
function patchDoc({ doc, ctx }: UndoHistoryState<DetachedRange>, editor: MinidocBase) {
  const leafs = new Map<string, Node[]>();

  Array.from(editor.root.children).forEach((n: any) => {
    const key: string = n.serialize ? n.serialize() : n.outerHTML;
    const arr = leafs.get(key) || [];
    n.remove();
    arr.push(n);
    leafs.set(key, arr);
  });

  editor.root.innerHTML = '';

  Array.from(h('div', { innerHTML: doc }).children).forEach((n) => {
    const key = n.outerHTML;
    const existingLeaf = leafs.get(key);
    if (existingLeaf?.length) {
      editor.root.append(existingLeaf.pop()!);
    } else {
      editor.root.append((editor as MinidocBase & Scrubbable).scrub(Dom.toFragment([n])));
    }
  });

  const selection = Rng.attachTo(ctx, editor.root);
  selection && Rng.setCurrentSelection(selection);
}

function init(editor: MinidocBase & Undoable & Redoable & Changeable & Serializable) {
  const el = editor.root;

  // We track the caret until the user makes an edit, then we wait
  // for undo / redo capture before we track the caret again.
  let isTrackingCaret = true;
  // If the caret changes as a result of an undo / redo, we ignore it.
  let isApplyingHistory = false;

  const undoHistory = undoRedo(
    { doc: editor.serialize(false), ctx: Rng.emptyDetachedRange() },
    () => {
      // Serialize should be an immutable operation, but there was a strange case
      // in Safari where it screwed up the range, probably due to calling normalize.
      // So, we have to serialize *prior* to getting the range. :/
      const doc = editor.serialize(false);
      const range = Rng.currentRange();
      const ctx = (range && Rng.detachFrom(range, el)) || Rng.emptyDetachedRange();
      return { doc, ctx };
    },
    () => {
      isTrackingCaret = true;
    },
  );

  editor.undo = () => {
    isApplyingHistory = true;
    patchDoc(undoHistory.undo(), editor);
  };

  editor.redo = () => {
    isApplyingHistory = true;
    patchDoc(undoHistory.redo(), editor);
  };

  editor.captureChange = (fn) => {
    undoHistory.commit();
    fn();
    undoHistory.commit();
  };

  editor.onChange = undoHistory.onChange;

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

  Dom.on(el, 'mini:caretchange', () => {
    if (isTrackingCaret && !isApplyingHistory) {
      const range = Rng.detachFrom(Rng.currentRange(), editor.root);
      range && undoHistory.setContext(range);
    }
    if (isApplyingHistory) {
      // If we are in the middle of an undo / redo event, this will have
      // been set to true, so this caretchange is a result of that event
      // completing, so we'll set this back to false again.
      isApplyingHistory = false;
      isTrackingCaret = true;
    }
  });

  Dom.on(el, 'mini:change', () => {
    // When the editor's content changes, assuming it's not
    // an undo / redo, we need to stop tracking the caret
    // until the undo / redo system captures the history state.
    // If we kept tracking the caret, we'd log invalid caret
    // positions in history.
    if (!isApplyingHistory) {
      isTrackingCaret = false;
    }
  });

  Dom.on(el, 'keyup', () => undoHistory.onChange());
}

/**
 * Mixin that converts the editor to a disposable interface.
 */
export const undoRedoMiddleware: EditorMiddlewareMixin<Undoable & Redoable & Changeable> = (
  next,
  editor,
) => {
  const result = next(
    editor as MinidocBase & Undoable & Redoable & Changeable & Mountable & Serializable,
  );

  // We have to initialize undo / redo only after the doc has been mounted. Prior to this,
  // the doc may be in an intermadiate / initializing state. The setTimeout is to put our
  // initialization after any DOM change events have propagated.
  setTimeout(() => init(result));

  return result;
};

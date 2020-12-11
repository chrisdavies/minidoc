import { diff, undo as undoStr, redo as redoStr, StrDelta } from './strdiff';

type DocProvider<T> = () => UndoHistoryState<T>;

interface UndoItem<T> {
  delta: StrDelta;
  prevCtx: T;
  ctx: T;
}

/**
 * Track undo / redo history for a sequence of strings.
 */
export function undoRedo<T>(
  initialState: UndoHistoryState<T>,
  docProvider: DocProvider<T>,
  { bufferInterval } = { bufferInterval: 2500 },
): UndoHistory<T> {
  let index = -1;
  let deltas: Array<UndoItem<T>> = [];
  let currState = initialState;
  let bufferTimeout: any;

  function clearBufferTimeout() {
    clearTimeout(bufferTimeout);
    bufferTimeout = undefined;
  }

  /**
   * Commit the current state to history.
   */
  function commit() {
    clearBufferTimeout();

    const nextState = docProvider();

    if (!nextState.doc) {
      return;
    }

    const delta = diff(currState.doc, nextState.doc);

    if (!delta) {
      return;
    }

    // When we've done several undos, then make new edits,
    // we need to obliterate redo history, since we're now
    // on a new branch.
    if (index !== deltas.length - 1) {
      deltas = deltas.slice(0, index + 1);
    }

    index = deltas.length;
    deltas.push({
      delta,
      prevCtx: currState.ctx,
      ctx: nextState.ctx,
    });

    currState = nextState;
  }

  /**
   * Notifies the history system that the document has been modified.
   */
  function onChange() {
    if (!bufferTimeout) {
      bufferTimeout = setTimeout(commit, bufferInterval);
    }
  }

  /**
   * Undo the current change, and return the previous doc.
   */
  function undo() {
    bufferTimeout && commit();

    if (index < 0) {
      return currState;
    }

    const delta = deltas[index];
    --index;

    currState = {
      doc: undoStr(currState.doc, delta.delta),
      ctx: delta.prevCtx,
    };

    return currState;
  }

  /**
   * Redo, and return the new doc.
   */
  function redo() {
    bufferTimeout && commit();

    if (!deltas.length || index > deltas.length - 2) {
      return currState;
    }

    index += 1;
    const delta = deltas[index];

    currState = {
      doc: redoStr(currState.doc, delta.delta),
      ctx: delta.ctx,
    };

    return currState;
  }

  return {
    onChange,
    commit,
    undo,
    redo,
  };
}

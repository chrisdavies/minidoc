/**
 * An undo / redo mechanism that allows for coordination of undo history across multiple
 * sources, such as Preact state and other rich text editors, etc. Each source instance
 * must have an id so that its state changes can be distinguished from the other sources.
 */

/**
 * The id of a provider and the prev / next state. When you redo into
 * an item, the next state is used, and when you undo, the previous
 * is used.
 */
type UndoRedoItem<T> = { prev: T; next: T };

export type UndoRedoOptions<T> = {
  initialState: T;
  setState(state: T): void;
  /**
   * The delay, in milliseconds, between a change and the time we capture
   * an undo snapshot.
   */
  delay?: number;
  /**
   * The maximum depth of the undo / redo history.
   */
  maxHistory?: number;
};

export type UndoRedo<T> = ReturnType<typeof makeUndoRedo<T>>;

/**
 * Create an undo / redo manager.
 */
export function makeUndoRedo<T>({
  delay = 500,
  maxHistory = 1024,
  initialState,
  setState,
}: UndoRedoOptions<T>) {
  const stack: UndoRedoItem<T>[] = [];
  // The index of the current undo / redo history item in the stack
  let index = -1;
  let timeout: any;
  let currentState = initialState;
  let pendingState: T | undefined;

  const commitState = () => {
    if (!pendingState) {
      return;
    }
    stack.splice(index + 1, stack.length - index + 1, {
      prev: currentState,
      next: pendingState,
    });
    currentState = pendingState;
    if (stack.length > maxHistory) {
      stack.splice(0, stack.length - maxHistory);
    }
    index = stack.length - 1;
    clearTimeout(timeout);
    pendingState = undefined;
    timeout = undefined;
  };

  const push = (item: T) => {
    if (currentState === item) {
      return;
    }
    pendingState = item;
    if (!timeout) {
      timeout = setTimeout(commitState, delay);
    }
  };

  const applyUndoRedo = (direction: -1 | 1) => {
    commitState();
    const nextIndex = index + direction;
    const item = stack[direction < 0 ? index : nextIndex];
    if (!item) {
      return false;
    }
    const state = direction < 0 ? item.prev : item.next;
    currentState = state;
    setState(state);
    index = nextIndex;
    return true;
  };

  const undo = () => applyUndoRedo(-1);

  const redo = () => applyUndoRedo(1);

  return {
    get canUndo() {
      return index >= 0 || !!pendingState;
    },
    get canRedo() {
      return index < stack.length - 1;
    },
    commitState,
    push,
    undo,
    redo,
  };
}

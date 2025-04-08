/**
 * An undo / redo mechanism that allows for coordination of undo history across multiple
 * sources, such as Preact state and other rich text editors, etc. Each source instance
 * must have an id so that its state changes can be distinguished from the other sources.
 */

/**
 * The id of the provider that owns the state and the new state.
 */
type StateChange = { id: string; state?: unknown; getValue?(): unknown };

/**
 * The id of a provider and the prev / next state. When you redo into
 * an item, the next state is used, and when you undo, the previous
 * is used.
 */
type UndoRedoItem = { id: string; prev: unknown; next: unknown };

/**
 * A provider such as a Preact state provider, a Lexical state provider, etc.
 */
type UndoRedoProvider = {
  id: string;
  currentState: unknown;
  setState(state: unknown): void;
};

export type UndoRedoOptions = {
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

export type UndoRedo = ReturnType<typeof makeUndoRedo>;

/**
 * Create an undo / redo manager.
 */
export function makeUndoRedo({ delay = 500, maxHistory = 1024 }: UndoRedoOptions = {}) {
  const stack: UndoRedoItem[] = [];
  // The index of the current undo / redo history item in the stack
  let index = -1;
  let timeout: any;
  let pendingState: StateChange | undefined;
  const providers: Record<string, UndoRedoProvider> = {};

  const registerProvider = (provider: UndoRedoProvider) => {
    providers[provider.id] = provider;
  };

  const commitState = () => {
    const provider = pendingState && providers[pendingState.id];
    if (!pendingState || !provider) {
      return;
    }
    // Get the state snapshot
    const state = pendingState.getValue?.() ?? pendingState.state;
    // Insert it at the current index.
    stack.splice(index + 1, stack.length - index + 1, {
      id: pendingState.id,
      prev: provider.currentState,
      next: state,
    });
    provider.currentState = state;
    if (stack.length > maxHistory) {
      stack.splice(0, stack.length - maxHistory);
    }
    index = stack.length - 1;
    clearTimeout(timeout);
    pendingState = undefined;
    timeout = undefined;
  };

  const push = (item: StateChange) => {
    const provider = providers[item.id];
    if (!provider || provider.currentState === item.state) {
      return;
    }
    if (pendingState && pendingState.id !== item.id) {
      commitState();
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
    const provider = item && providers[item.id];
    if (!provider) {
      return false;
    }
    const state = direction < 0 ? item.prev : item.next;
    provider.currentState = state;
    provider.setState(state);
    index = nextIndex;
    return true;
  };

  const undo = () => applyUndoRedo(-1);

  const redo = () => applyUndoRedo(1);

  return {
    get canUndo() {
      return index > 0 || !!pendingState;
    },
    get canRedo() {
      return index < stack.length - 1;
    },
    commitState,
    registerProvider,
    push,
    undo,
    redo,
  };
}

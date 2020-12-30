/**
 * The document and related context associated with an undo / redo event.
 * The context is generally a DetachedRange, but is generic for testing purposes.
 */
export interface UndoHistoryState<T> {
  doc: string;
  ctx: T;
}

export interface UndoHistory<T> {
  setContext(ctx: T): void;
  onChange(): void;
  commit(): void;
  undo(): UndoHistoryState<T>;
  redo(): UndoHistoryState<T>;
}

/**
 * This data structure is used to track a caret position when dealing with undo / redo.
 */
export interface DetachedPosition {
  /**
   * The range offset.
   */
  offset: number;
  /**
   * The path of offsets that, if followed, will take you from the editor root
   * to a descendant node which will be selected.
   */
  path: number[];
}

/**
 * A Range which can be restored on a different DOM tree than the one from on which it was created.
 */
export interface DetachedRange {
  start: DetachedPosition;
  end?: DetachedPosition;
}

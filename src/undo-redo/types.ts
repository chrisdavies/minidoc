import { DetachedRange } from '../range';

/**
 * The document and related context associated with an undo / redo event.
 * The context is generally a DetachedRange, but is generic for testing purposes.
 */
export interface UndoHistoryState {
  doc: string;
  range: DetachedRange;
}

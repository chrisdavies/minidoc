/**
 * This mixin provides a mechanism for reacting to character sequences and
 * taking an editor action when a matching character sequence is found.
 * For example, typing `- ` on a new line converts the line to a list.
 */

import * as Rng from '../range';
import * as Dom from '../dom';
import { EditorMiddleware, MinidocBase } from '../types';

type SequenceHandler = (node: Node) => unknown;

export interface OnSequenceable {
  /**
   * Run code any time a specific character sequence is typed at the
   * start of a new line.
   * @param sequence The character sequence
   * @param handler The handler
   */
  onSequence(sequence: string, handler: SequenceHandler): void;
}

export const onSequenceMixin: EditorMiddleware<OnSequenceable> = (next, editor) => {
  const result = editor as MinidocBase & OnSequenceable;
  // An index of key -> sequence -> SequenceHandler
  const handlers: Record<string, Record<string, SequenceHandler>> = {};

  result.onSequence = (sequence, handler) => {
    const lastChar = sequence[sequence.length - 1];
    const map = handlers[lastChar] || {};
    map[sequence] = handler;
    handlers[lastChar] = map;
  };

  Dom.on(editor.root, 'keydown', (e) => {
    if (e.defaultPrevented) {
      return;
    }
    const map = handlers[e.key];
    if (!map) {
      return;
    }
    const node = Rng.currentNode();
    if (!Dom.isText(node) || node.previousSibling) {
      return;
    }
    const handler = map[node.textContent + e.key];
    if (handler) {
      e.preventDefault();
      handler(node);
    }
  });

  return next(result);
};

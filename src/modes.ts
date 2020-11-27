/**
 * When editing, context matters. For instance, if you're within a list the editor
 * has a different behavior than when you're within a table or paragraph, etc. We
 * handle this via modes. A mode is simply a set of event handlers that are run
 * based on what element the caret is in.
 */

import * as Rng from './range';
import * as Dom from './dom';

export interface Mode {
  onEnter?(): void;
}

export const modes: { default: Mode; [withinTag: string]: Mode } = {
  LI: {
    onEnter() {
      const range = Rng.currentRange();
      if (!range) {
        return;
      }
      range.deleteContents();
      const li = Dom.closest('li', Rng.toNode(range)!)!;
      if (!li) {
        // We deleted a selection which started in an li, but ended in
        // a non-list (paragraph or whatever), so there's nothing left
        // to do.
        return;
      }
      if (!Dom.isEmpty(li)) {
        // We're in a non-empty li. In this scenario, we split it at the caret.
        const [a, b] = Rng.$splitContainer(Dom.closest('li'), range);
        Dom.$makeEditable(a);
        Dom.$makeEditable(b);
        Rng.setCaretAtStart(b);
        return;
      }
      // We're in an empty li, and the user is attempting to break out of it
      const [a, b] = Rng.$splitContainer(Dom.findLeaf, range);
      const newLeaf = Dom.insertAfter(Dom.newLeaf(), a);
      // Since the li is empty we need to remove it
      Dom.remove(li);
      // We also need to remove the first li from b, since it is
      // a clone of our empty li.
      Dom.remove(b.querySelector('li') || undefined);
      Dom.isEmpty(a) && Dom.remove(a);
      Dom.isEmpty(b) && Dom.remove(b);
      Rng.setCaretAtStart(newLeaf);
    },
  },
  default: {
    onEnter() {
      const range = Rng.currentRange();
      if (!range) {
        return;
      }
      range.deleteContents();
      const [a, b] = Rng.$splitContainer(Dom.findLeaf, range);
      Dom.$makeEditable(a);
      Dom.$makeEditable(b);
      Rng.setCaretAtStart(b);
    },
  },
};

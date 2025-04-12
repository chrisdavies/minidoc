import { EditorMiddleware, EditorState, MinidocBase } from '../types';
import { Disposable, initialize } from '../disposable';
import * as Dom from '../dom';
import * as Rng from '../range';
import { Cardable } from '../card';
import { Scrubbable } from '../scrubbable';
import { Mountable } from '../mountable';

export interface Serializable {
  serialize(): string;
  state: EditorState;
  setState(state: EditorState, opts?: { focus: boolean }): void;
}

function isSerializable(n: any): n is Serializable {
  return n.serialize;
}

/**
 * Given a card element, serialize it for comparison purposes.
 */
function cardKey(n: HTMLElement) {
  if (isSerializable(n)) {
    return n.serialize();
  }
  return n.outerHTML;
}

/**
 * Mixin that initializes important core features.
 */
export const coreMixin: EditorMiddleware<Disposable & Serializable> = (next, editor) => {
  const result = editor as MinidocBase &
    Serializable &
    Scrubbable &
    Mountable &
    Cardable &
    Disposable;
  let prevState: EditorState | undefined;
  let changed = false;

  // Add the dispose behavior, and handle core changes.
  const el = initialize(result.root, () => {
    const range = Rng.currentRange();
    result.state = {
      doc: result.serialize(),
      selection: (range && Rng.detachFrom(range, editor.root)) || Rng.emptyDetachedRange(),
    };
    if (changed || (prevState && prevState.doc !== result.state.doc)) {
      changed = true;
      Dom.emit(el, 'mini:change');
    }
    prevState = result.state;
  });

  result.dispose = el.dispose;

  /**
   * Serialze the editor either for save or for a UI (undo / redo) mechanism.
   */
  result.serialize = () =>
    Array.from(el.children)
      .map((n) =>
        isSerializable(n)
          ? // Use custom serialization if the element has specified it
            n.serialize()
          : // Use outerHTML, but remove any empty tags <foo></foo>
            n.outerHTML.replace(/<([a-z\-]+)><\/([a-z\-]+)>/g, (a, b, c) => (b === c ? '' : a)),
      )
      .join('');

  /**
   * Set the editor state, if it has changed.
   */
  result.setState = (state, opts) => {
    if (result.state && result.state.doc === state.doc) {
      return;
    }
    try {
      el.pause();

      result.state = state;

      // Put old cards into a map so we can reuse them
      let newContent = Dom.toFragment(Dom.h('div', { innerHTML: state.doc }).childNodes);
      if (result.$cardSelector) {
        const oldCards: Record<string, HTMLElement[]> = {};
        for (const card of editor.root.querySelectorAll('mini-card') as unknown as HTMLElement[]) {
          const key = cardKey(card);
          const arr = oldCards[key] || [];
          arr.push(card);
          oldCards[key] = arr;
        }
        for (const card of Array.from(
          newContent.querySelectorAll<HTMLElement>(result.$cardSelector),
        )) {
          const key = cardKey(card);
          const originals = oldCards[key];
          if (originals?.length) {
            card.replaceWith(originals.pop()!);
          }
        }
      }

      newContent = result.scrub(newContent);
      editor.root.replaceChildren(newContent);
      result.beforeMount(editor.root);

      if (state.selection?.start.length) {
        const range = Rng.attachTo(state.selection, editor.root);
        range && Rng.setCurrentSelection(range);
      } else {
        state.selection = editor.root.children.length
          ? { start: [0, 0] }
          : Rng.emptyDetachedRange();
      }

      if (opts?.focus !== false) {
        editor.root.focus();
      }
    } finally {
      el.resume();
    }
  };

  return next(result);
};

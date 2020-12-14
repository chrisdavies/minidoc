import * as Dom from '../dom';
import * as Rng from '../range';
import { h } from '../dom';
import { UndoHistoryState, DetachedRange, MinidocEditor } from '../types';

function cardsEqual(a?: Element, b?: Element) {
  return (
    a &&
    b &&
    a.getAttribute('type') === b.getAttribute('type') &&
    a.getAttribute('state') === b.getAttribute('state')
  );
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
export function patchDoc({ doc, ctx }: UndoHistoryState<DetachedRange>, editor: MinidocEditor) {
  const existingCards: Element[] = [];
  const range = Rng.createRange();
  range.setStart(editor.root, 0);
  let cardIndex = 0;

  Array.from(editor.root.childNodes).forEach((n) => {
    if (Dom.isCard(n)) {
      existingCards.push(n);
    } else {
      n.remove();
    }
  });

  Array.from(h('div', { innerHTML: doc }).childNodes).forEach((n) => {
    const newCard = Dom.isCard(n) ? n : undefined;
    const existingCard = existingCards[cardIndex];

    newCard && ++cardIndex;

    if (cardsEqual(newCard, existingCard)) {
      range.setStartAfter(existingCard);
      return;
    }

    newCard && existingCard?.remove();
    range.insertNode(editor.beforeMount(Dom.toFragment([n])));
    n.isConnected && range.setStartAfter(n);
  });

  existingCards.slice(cardIndex).forEach((n) => n.remove());

  const selection = Rng.attachTo(ctx, editor.root);
  selection && Rng.setCurrentSelection(selection);
}

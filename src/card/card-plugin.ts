import * as Dom from '../dom';
import * as Rng from '../range';
import { compose } from '../util';
import { h } from '../dom';
import { enableDragDrop, makeDraggable } from './draggable';

const cardTagName = 'MINI-CARD';

const stopPropagation = (e: Event) => e.stopPropagation();

function toggleActive(el: Element, isActive: boolean) {
  el.classList.toggle('minidoc-card-active', isActive);
}

function mountCard<T extends MinidocEditor>(el: Element, editor: Cardable<T>) {
  if (el.tagName !== cardTagName || (el as ImmutableLeaf).$immutable) {
    return;
  }
  (el as ImmutableLeaf).$immutable = true;
  const cardType = Dom.attr('type', el)!;
  const state = JSON.parse(Dom.attr('state', el) || 'null');
  const { render } = editor.cards.definitions[cardType];
  Dom.assignAttrs(
    {
      tabindex: -1,
      class: 'minidoc-card',
    },
    el,
  );

  const content = h(
    '.minidoc-card-contents',
    {
      contenteditable: 'false',
      // We may want to allow some events through (e.g. Ctrl + S)
      onkeydown: stopPropagation,
      onkeypress: stopPropagation,
      onpaste: stopPropagation,
      oncut: stopPropagation,
      oncopy: stopPropagation,
      input: stopPropagation,
    },
    render({
      state,
      editor,
      stateChanged(state) {
        Dom.assignAttrs({ state: JSON.stringify(state) }, el);
      },
    }),
  );

  Dom.appendChildren(
    [
      // Captures the focus when the caret moves up into the card
      h('minidoc-focuser', { tabindex: -1, innerHTML: '&zwnj;' }),
      content,
    ],
    el,
  );

  Dom.on(el, 'focus', () => {
    editor.cards.activateCard(el, true);
    // The setTimeout allows drag / drop to work
    setTimeout(() => Rng.setCaretAtStart(el));
  });

  makeDraggable(content);
}

function handleDeleteIntoCard(e: KeyboardEvent) {
  // Check if we're backspacing / deleting into a card. If so, instead of deleting it / merging,
  // we want to simply focus the card. The *next* backspace / delete will then delete it.
  if (e.code !== 'Backspace' && e.code !== 'Delete') {
    return;
  }
  const range = Rng.currentRange();
  if (!range?.collapsed) {
    return;
  }
  const leaf = Dom.findLeaf(Rng.toNode(range))!;
  const deletingInto =
    e.code === 'Backspace'
      ? Rng.isAtStartOf(leaf, range) &&
        leaf.previousElementSibling?.matches(cardTagName) &&
        leaf.previousElementSibling
      : Rng.isAtEndOf(leaf, range) &&
        leaf.nextElementSibling?.matches(cardTagName) &&
        leaf.nextElementSibling;
  if (!deletingInto) {
    return;
  }
  e.preventDefault();
  Rng.setCaretAtStart(deletingInto);
  if (Dom.isEmpty(leaf, true)) {
    leaf.remove();
  }
}

/**
 * Add support for cards to minidoc.
 */
export function cardPlugin(defs: MinidocCardDefinition[]) {
  return <T extends MinidocEditor>(editor: T): T => {
    const cardable = editor as Cardable<T>;
    const activeCards = new Set<Element>();

    cardable.cards = {
      definitions: defs.reduce((acc, c) => {
        acc[c.type] = c;
        return acc;
      }, {} as CardPluginContext['definitions']),

      activateCard(el, activate) {
        toggleActive(el, activate);
        if (!activate) {
          activeCards.delete(el);
        } else if (!activeCards.has(el)) {
          cardable.cards.deactivateCards();
          activeCards.add(el);
        }
      },

      deactivateCards() {
        activeCards.forEach((el) => toggleActive(el, false));
        activeCards.clear();
      },

      insert(type, initialState) {
        const card = h(cardTagName, {
          type,
          state: JSON.stringify(initialState),
          tabindex: -1,
        });
        Rng.$splitAndInsert(Dom.findLeaf, Rng.currentRange()!, Dom.toFragment(card));
        mountCard(card, editor as Cardable<T>);
        Rng.setCaretAtStart(card);
        return card;
      },
    };

    // When the editor loads a doc, we need to mount all the cards
    // before history and other plugins kick in.
    editor.beforeMount = compose(editor.beforeMount, (frag) => {
      frag.querySelectorAll(cardTagName).forEach((n) => mountCard(n, cardable));
      return frag;
    });

    // When we serialize, we need to clear out the card contents, since only
    // card state is relevant for serialization.
    editor.beforeSerialize = compose(editor.beforeSerialize, (el) => {
      Array.from(el.querySelectorAll(cardTagName)).forEach((c) => {
        c.replaceWith(
          h(cardTagName, {
            type: Dom.attr('type', c),
            state: Dom.attr('state', c),
          }),
        );
      });
      return el;
    });

    // If the caret enters a card, display it as active.
    editor.on('caretchange', () => {
      const card = Dom.closest(cardTagName, Rng.currentNode());
      if (card) {
        cardable.cards.activateCard(card, true);
      } else {
        cardable.cards.deactivateCards();
      }
    });

    Dom.on(editor.root, 'keydown', (e) => {
      // Deleting from an element into a card
      handleDeleteIntoCard(e);

      if (e.defaultPrevented || !editor.isActive(cardTagName)) {
        return;
      }

      if (e.code === 'Enter') {
        e.preventDefault();
        Rng.setCaretAtStart(Dom.insertAfter(Dom.newLeaf(), Dom.findLeaf(Rng.currentNode()!)!));
        return;
      }

      if (e.code === 'Backspace' || e.code === 'Delete') {
        const range = Rng.currentRange();
        if (range?.collapsed) {
          e.preventDefault();
          activeCards.forEach((el) => {
            const replacement = Dom.newLeaf();
            el.replaceWith(replacement);
            Rng.setCaretAtStart(replacement);
          });
        } else {
          activeCards.forEach((el) => el.remove());
        }
        activeCards.clear();
      } else if (!e.code.includes('Arrow') && !e.metaKey && !e.ctrlKey) {
        // We only allow arrow, delete, backspace within a card.
        e.preventDefault();
      }
    });

    enableDragDrop(editor.root, () => editor.undoHistory.onChange());

    return editor;
  };
}

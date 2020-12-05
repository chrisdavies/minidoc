import * as Dom from '../dom';
import * as Rng from '../range';
import { compose } from '../util';
import { h } from '../dom';

interface CardPluginContext {
  definitions: { [type: string]: MinidocCardDefinition };
  activateCard(el: Element, activate: boolean): void;
  deactivateCards(): void;
  insert(type: string, initialState: any): void;
}

type Cardable<T extends MinidocCoreEditor = MinidocCoreEditor> = T & { cards: CardPluginContext };

const cardTagName = 'MINI-CARD';

const stopPropagation = (e: Event) => e.stopPropagation();

const newId = (() => {
  // We use these ids to identifiy cards within an editor instance, only for
  // the duration of the editing session. These aren't persisted, and are there
  // to prevent us from passing the wrong state into an updated card.
  // We'll start off with a random long, which is good enough for our purposes.
  // We also use them to identify files.
  let id = Math.random() * 10000000000000000;
  id = id & id;
  return () => `card-${(++id).toString(36)}`;
})();

function toggleActive(el: Element, isActive: boolean) {
  el.classList.toggle('minidoc-card-active', isActive);
}

function mountCard<T extends MinidocCoreEditor>(el: Element, editor: Cardable<T>) {
  if (el.tagName !== cardTagName || (el as any).$initialized) {
    return;
  }
  (el as any).$initialized = true;
  const cardType = Dom.attr('type', el)!;
  const state = JSON.parse(Dom.attr('state', el) || 'null');
  const { render } = editor.cards.definitions[cardType];
  Dom.assignAttrs(
    {
      id: newId(),
      tabindex: -1,
      class: 'minidoc-card',
    },
    el,
  );

  Dom.appendChildren(
    [
      // Captures the focus when the caret moves up into the card
      h('minidoc-focuser', { tabindex: -1, innerHTML: '&zwnj;' }),
      h(
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
      ),
    ],
    el,
  );

  Dom.on(el, 'focus', () => {
    editor.cards.activateCard(el, true);
    Rng.setCaretAtStart(el);
  });
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
  return <T extends MinidocCoreEditor>(editor: T): T => {
    const cardable = editor as Cardable<T>;
    const activeCards = new Set<Element>();

    cardable.cards = {
      definitions: defs.reduce((acc, c) => {
        acc[c.type] = c;
        return acc;
      }, {} as CardPluginContext['definitions']),

      activateCard(el, activate) {
        toggleActive(el, activate);
        if (activate) {
          activeCards.add(el);
        } else {
          activeCards.delete(el);
        }
      },

      deactivateCards() {
        activeCards.forEach((el) => toggleActive(el, false));
        activeCards.clear();
      },

      insert(type, initialState, opts = {}) {
        const leaf = Dom.findLeaf(Rng.currentNode()!);
        const card = h(cardTagName, {
          type,
          state: JSON.stringify(initialState),
          id: newId(),
          tabindex: -1,
        });
        if (leaf) {
          Dom.insertAfter(card, leaf);
        } else {
          Dom.appendChildren(card, editor.root);
        }
        mountCard(card, editor as Cardable<T>);
        Rng.setCaretAtStart(card);
        return card;
      },
    };

    // When the editor loads a doc, we need to mount all the cards
    // before history and other plugins kick in.
    editor.beforeMount = compose(editor.beforeMount, (el) => {
      el.querySelectorAll(cardTagName).forEach((n) => mountCard(n, cardable));
      return el;
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

      if (e.defaultPrevented || !editor.isWithin(cardTagName)) {
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
      } else if (!e.code.includes('Arrow')) {
        // We only allow arrow, delete, backspace within a card.
        e.preventDefault();
      }
    });

    return editor;
  };
}

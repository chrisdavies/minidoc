import * as Dom from '../dom';
import * as Rng from '../range';
import { compose } from '../util';
import { h } from '../dom';
import { EditorMiddlewareMixin, ImmutableLeaf, MinidocBase } from '../types';
import { Mountable } from '../mountable/mountable';
import { Serializable } from '../serializable/serializable';
import { InlineTogglable } from '../inilne-toggle';
import { DragDroppable } from '../drag-drop';

export interface CardRenderOptions {
  state: any;
  editor: MinidocBase;
  stateChanged(state: any): void;
}

export interface MinidocCardDefinition {
  type: string;
  render(opts: CardRenderOptions): Element;
}

export interface Cardable {
  insertCard(type: string, initialState: any): void;
  defineCard(def: MinidocCardDefinition): void;
}

interface CardPluginContext {
  definitions: { [type: string]: MinidocCardDefinition };
  activateCard(el: Element, activate: boolean): void;
  deactivateCards(): void;
  insert(type: string, initialState: any): void;
}

const cardTagName = 'MINI-CARD';

const stopPropagation = (e: Event) => e.stopPropagation();

function toggleActive(el: Element, isActive: boolean) {
  el.classList.toggle('minidoc-card-active', isActive);
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
export const cardMiddleware = (defs: MinidocCardDefinition[]): EditorMiddlewareMixin<Cardable> => (
  next,
  editor,
) => {
  const result = editor as MinidocBase & Cardable & Mountable & InlineTogglable & DragDroppable;
  const activeCards = new Set<Element>();

  const definitions = defs.reduce((acc, c) => {
    acc[c.type] = c;
    return acc;
  }, {} as CardPluginContext['definitions']);

  function deactivateCards() {
    activeCards.forEach((el) => toggleActive(el, false));
    activeCards.clear();
  }

  function activateCard(el: Element, activate: boolean) {
    toggleActive(el, activate);
    if (!activate) {
      activeCards.delete(el);
    } else if (!activeCards.has(el)) {
      deactivateCards();
      activeCards.add(el);
    }
  }

  function mountCard(el: Element, editor: MinidocBase) {
    if (el.tagName !== cardTagName || (el as ImmutableLeaf).$immutable) {
      return;
    }
    (el as ImmutableLeaf).$immutable = true;
    const cardType = Dom.attr('type', el)!;
    const def = definitions[cardType];
    if (!def) {
      throw new Error(`Unknown card type "${cardType}"`);
    }
    const state = JSON.parse(Dom.attr('state', el) || 'null');
    const { render } = definitions[cardType];
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
      activateCard(el, true);
      // The setTimeout allows drag / drop to work
      setTimeout(() => Rng.setCaretAtStart(el));
    });

    ((el as unknown) as Serializable).serialize = () =>
      h(cardTagName, {
        type: Dom.attr('type', el),
        state: Dom.attr('state', el),
      }).outerHTML;

    content.setAttribute('draggable', 'true');
  }

  result.defineCard = (def) => (definitions[def.type] = def);

  result.insertCard = (type, initialState) => {
    const card = h(cardTagName, {
      type,
      state: JSON.stringify(initialState),
      tabindex: -1,
    });
    Rng.$splitAndInsert(Dom.findLeaf, Rng.currentRange()!, Dom.toFragment(card));
    mountCard(card, result);
    Rng.setCaretAtStart(card);
    return card;
  };

  // When the editor loads a doc, we need to mount all the cards
  // before history and other plugins kick in.
  result.beforeMount = compose(result.beforeMount, (frag) => {
    frag.querySelectorAll(cardTagName).forEach((n) => mountCard(n, result));
    return frag;
  });

  // If the caret enters a card, display it as active.
  Dom.on(editor.root, 'mini:caretchange', () => {
    const card = Dom.closest(cardTagName, Rng.currentNode());
    if (card) {
      activateCard(card, true);
    } else {
      deactivateCards();
    }
  });

  Dom.on(editor.root, 'keydown', (e) => {
    // Deleting from an element into a card
    handleDeleteIntoCard(e);

    if (e.defaultPrevented || !result.isActive(cardTagName)) {
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

  Dom.on(editor.root, 'dragstart', (e) => {
    if (e.defaultPrevented || !e.target) {
      return;
    }
    const draggingEl = Dom.findLeaf(e.target as Node) as HTMLElement | undefined;
    if (!draggingEl) {
      return;
    }
    draggingEl.style.opacity = '1';
    result.beginDragDrop(e, (_, target) => {
      target.isConnected && target.replaceWith(draggingEl);
      draggingEl.style.opacity = '1';
      return draggingEl;
    });
    draggingEl.style.opacity = '0.2';
  });

  return next(result);
};

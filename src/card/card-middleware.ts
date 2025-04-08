import * as Dom from '../dom';
import * as Rng from '../range';
import { compose } from '../util';
import { h } from '../dom';
import { EditorMiddleware, ImmutableLeaf, MinidocBase } from '../types';
import { Mountable } from '../mountable/mountable';
import { Serializable } from '../serializable/serializable';
import { InlineTogglable } from '../inline-toggle';
import { DragDroppable } from '../drag-drop';
import { Scrubbable } from '../scrubbable';

const rightCaretClass = 'minidoc-card-caret-right';
const leftCaretClass = 'minidoc-card-caret-left';

export function getBehavior<T>(node?: Node): T | undefined {
  return node && (node as any).$behavior;
}

export interface CardRenderOptions<T extends object = any> {
  state: T;
  readonly: boolean;
  editor: MinidocBase;
  container: HTMLElement;
  stateChanged(state: T): void;
  /**
   * The render method can set this to an object or function or whatever it
   * wants, allowing outside components / logic to communicate with the card,
   * if desired. For example, an "image" card could set this to be:
   * { setHref: (href) => { ... } } in order to allow the link toolbar action
   * to wrap the image in a hyperlink.
   */
  behavior?: any;
}

export interface MinidocCardDefinition<T extends object = any> {
  type: string;
  selector: string;
  deriveState(el: HTMLElement): T;
  serialize(opts: CardRenderOptions<T>): string;
  render(opts: CardRenderOptions<T>): Element;
}

export interface Cardable {
  insertCard<T = any>(type: string, initialState: T): void;
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
  if (!isActive) {
    el.classList.remove(leftCaretClass, rightCaretClass);
  }
  el.classList.toggle('minidoc-card-active', isActive);
}

function assignCaret(el: Element, caret: string) {
  el.classList.remove(leftCaretClass, rightCaretClass);
  el.classList.add(caret);
}

/**
 * Add support for cards to minidoc.
 */
export const cardMiddleware =
  (defs: MinidocCardDefinition[]): EditorMiddleware<Cardable> =>
  (next, editor) => {
    const result = editor as MinidocBase &
      Cardable &
      Mountable &
      InlineTogglable &
      DragDroppable &
      Scrubbable;
    const activeCards = new Set<Element>();
    const selector = [cardTagName, ...defs.map((d) => d.selector).filter((s) => !!s)].join(',');

    const definitions = defs.reduce(
      (acc, c) => {
        acc[c.type] = c;
        return acc;
      },
      {} as CardPluginContext['definitions'],
    );

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

    function mountCard(el: Element, editor: MinidocBase, state?: any) {
      if (!el.matches(selector) || (el as ImmutableLeaf).$immutable) {
        return el;
      }

      ensureLeaf(el);

      const def =
        el.tagName !== cardTagName
          ? defs.find((d) => d.selector && !!d.deriveState && el.matches(d.selector))!
          : definitions[Dom.attr('type', el)!];

      (el as ImmutableLeaf).$immutable = true;
      if (!def) {
        console.error(el);
        throw new Error(`Unknown card type`);
      }
      if (state === undefined) {
        state = def.deriveState
          ? def.deriveState(el as HTMLElement)
          : JSON.parse(Dom.attr('state', el) || '{}');
      }
      if (el.tagName !== cardTagName) {
        const newEl = h('mini-card', { type: def.type, state: JSON.stringify(state) });
        el.replaceWith(newEl);
        el = newEl;
        (el as ImmutableLeaf).$immutable = true;
      }
      const { render } = def;
      Dom.assignAttrs(
        {
          tabindex: -1,
          class: 'minidoc-card',
        },
        el,
      );
      const opts: CardRenderOptions = {
        editor,
        container: el as HTMLElement,
        readonly: !!editor.readonly,
        state,
        stateChanged(state) {
          Dom.assignAttrs({ state: JSON.stringify(state) }, el);
        },
      };
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
        render(opts),
      );

      // If the render function set the behavior property, we'll add it to the
      // root element to make it programmatically accessible.
      if (opts.behavior) {
        (el as any).$behavior = opts.behavior;
      }

      Dom.appendChildren(
        [
          // Captures the focus when the caret moves up into the card
          h('minidoc-focuser', { tabindex: -1, innerHTML: '&zwnj;' }),
          content,
        ],
        el,
      );

      !editor.readonly &&
        Dom.on(el, 'focus', () => {
          activateCard(el, true);
          // The setTimeout allows drag / drop to work
          setTimeout(() => Rng.setCaretAtStart(el));
        });

      (el as unknown as Serializable).serialize = () => def.serialize(opts);

      !opts.readonly && content.setAttribute('draggable', 'true');
      return el;
    }

    result.defineCard = (def) => (definitions[def.type] = def);

    result.insertCard = (type, initialState) => {
      const card = h(cardTagName, {
        type,
        state: JSON.stringify(initialState),
        tabindex: -1,
      });
      Rng.$splitAndInsert(Dom.findLeaf, Rng.currentRange()!, Dom.toFragment(card));
      mountCard(card, result, initialState);
      Rng.setCaretAtStart(card);
      return card;
    };

    // When the editor loads any content, we need to mount all the cards
    // before history and other plugins kick in.
    result.scrub = compose((node) => {
      const parentNode = node as unknown as ParentNode;
      if (parentNode.querySelectorAll) {
        parentNode.querySelectorAll(selector).forEach((n) => {
          if (Dom.isImmutable(Dom.findLeaf(n))) {
            return;
          }
          mountCard(n, result);
        });
      }
      return node;
    }, result.scrub);

    // If the caret enters a card, display it as active.
    !editor.readonly &&
      Dom.on(editor.root, 'mini:caretchange', () => {
        const card = Dom.closest(cardTagName, Rng.currentNode());
        if (card) {
          activateCard(card, true);
        } else {
          deactivateCards();
        }
      });

    !editor.readonly &&
      Dom.on(editor.root, 'keydown', (e) => {
        if (e.defaultPrevented || !result.isActive(cardTagName)) {
          return;
        }

        const card = activeCards.values().next().value;
        if (!card) {
          return;
        }

        if (e.code === 'ArrowLeft' || (e.code === 'ArrowUp' && card === editor.root.children[0])) {
          if (!card.classList.contains(leftCaretClass)) {
            e.preventDefault();
            assignCaret(card, leftCaretClass);
          }
          return;
        } else if (
          e.code === 'ArrowRight' ||
          (e.code === 'ArrowDown' && card === editor.root.children[editor.root.children.length - 1])
        ) {
          if (!card.classList.contains(rightCaretClass)) {
            e.preventDefault();
            assignCaret(card, rightCaretClass);
          }
          return;
        }

        if (e.key === 'Enter') {
          e.preventDefault();
          const leaf = Dom.findLeaf(Rng.currentNode()!)!;
          if (card.classList.contains(leftCaretClass)) {
            editor.root.insertBefore(Dom.newLeaf(), leaf);
          } else {
            Rng.setCaretAtStart(Dom.insertAfter(Dom.newLeaf(), leaf));
          }
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

    !editor.readonly &&
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

function ensureLeaf(el: Element) {
  // Cards are expected to be leaf nodes. This detects the scenario
  // where a card is not a leaf, and promotes it to a leaf node.
  if (!el.parentNode || Dom.isRoot(el.parentNode)) {
    return;
  }

  const leaf = Dom.findLeaf(el);
  if (!leaf?.parentNode) {
    return;
  }

  const range = Rng.createRange();
  range.selectNodeContents(leaf);
  range.setStartAfter(el);
  const frag = range.extractContents();
  if (!Dom.isEmpty(frag) || frag.querySelector('img,audio,video')) {
    Dom.insertAfter(h('p', frag), leaf);
  }
  Dom.insertAfter(el, leaf);
}

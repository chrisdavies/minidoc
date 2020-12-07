/**
 * This is the core editor. It doesn't know about toolbars and the like.
 * It's just concern with being a sane wrapper around the content editable.
 */

import * as Dom from '../dom';
import * as Rng from '../range';
import { h } from '../dom';
import { createEmitter } from '../emitter';
import { toggleBlock, toggleInline } from '../default-plugin';
import { toggleList } from '../list';

interface CoreOptions {
  doc: string;
  plugins: MinidocPlugin[];
}

function trackSelectionChange(el: Element, handler: () => void) {
  // Disable selection change tracking.
  let off: (() => void) | undefined;

  // When the selection changes within the element,
  // we'll fire off a selection change event.
  Dom.on(el, 'focus', () => {
    if (!off) {
      off = Dom.on(document, 'selectionchange', handler);
    }
  });

  Dom.on(el, 'blur', () => {
    off?.();
    off = undefined;
  });
}

function computeActiveTags(activeTags: Set<string>, root: Element, child: Node) {
  activeTags.clear();
  while (true) {
    const parent = child.parentElement;
    if (!parent || parent === root) {
      break;
    }
    activeTags.add(parent.tagName);
    child = parent;
  }
  return activeTags;
}

export function createCoreEditor({ doc, plugins }: CoreOptions): MinidocCoreEditor {
  const events = createEmitter<MinidocEvent>();
  // The tag names within which the caret is located
  const activeTags: Set<string> = new Set<string>();
  const el = h('div.minidoc-editor', {
    contentEditable: true,
    innerHTML: doc,
  });

  let editor: MinidocCoreEditor = {
    root: el,

    isWithin(tag: string) {
      return activeTags.has(tag.toUpperCase());
    },

    on(evt: MinidocEvent, handler: () => any) {
      return events.on(evt, handler);
    },

    emit: events.emit,

    toggleBlock(tagName: string) {
      const range = Rng.currentRange();
      range && toggleBlock(tagName, range);
    },

    caretChanged() {
      computeActiveTags(activeTags, el, Rng.toNode(Rng.currentRange()!));
      events.emit('caretchange');
    },

    toggleInline(tagName: string) {
      const range = Rng.currentRange();
      range && toggleInline(tagName, range);
    },

    toggleList(tagName: 'ol' | 'ul') {
      const range = Rng.currentRange();
      range && Rng.setCurrentSelection(toggleList(tagName, range));
    },

    serialize() {
      return editor.beforeSerialize(el).innerHTML;
    },

    beforeMount(x) {
      // Sanitize the editor root. Vanilla text nodes are not allowed as leafs.
      Array.from(x.childNodes).forEach((n) => Dom.isText(n) && n.remove());
      // Ensure the editor root has at least one editable element in it.
      Dom.$makeEditable(x);
      return x;
    },

    beforeSerialize(el: Element) {
      // TODO: sanitize and clean, remove temporary elements such as highlighters, etc.
      return el.cloneNode(true) as Element;
    },
  };

  // When the selection changes within the element,
  // we'll fire off a selection change event.
  trackSelectionChange(el, editor.caretChanged);

  editor = plugins.reduce((acc, p) => p(acc), editor);
  editor.beforeMount(el);

  return editor;
}

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
import { undoRedo } from '../undo-redo';
import { patchDoc } from './patch-doc';
import { activeTagTracker } from './active-tags';

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

function applyToggler(
  s: string,
  editor: MinidocCoreEditor,
  toggler: (s: string, r: Range) => Range,
) {
  const range = Rng.currentRange();
  if (range) {
    editor.undoHistory.commit();
    Rng.setCurrentSelection(toggler(s, range));
    editor.undoHistory.commit();
  }
}

export function createCoreEditor({ doc, plugins }: CoreOptions): MinidocCoreEditor {
  const events = createEmitter<MinidocEvent>();

  const el = h('div.minidoc-editor', {
    contentEditable: true,
    innerHTML: doc,
  });

  const activeTags = activeTagTracker({
    ...events,
    root: el,
  });

  let editor: MinidocCoreEditor = {
    root: el,

    isActive: activeTags.isActive,

    on(evt: MinidocEvent, handler: () => any) {
      return events.on(evt, handler);
    },

    emit: events.emit,

    undoHistory: undoRedo({ doc, ctx: Rng.emptyDetachedRange() }, () => {
      // Serialize should be an immutable operation, but there was a strange case
      // in Safari where it screwed up the range, probably due to calling normalize.
      // So, we have to serialize *prior* to getting the range. :/
      const doc = editor.serialize();
      const range = Rng.currentRange();
      const ctx = (range && Rng.detachFrom(range, el)) || Rng.emptyDetachedRange();
      return { doc, ctx };
    }),

    undo() {
      patchDoc(editor.undoHistory.undo(), editor);
    },

    redo() {
      patchDoc(editor.undoHistory.redo(), editor);
    },

    caretChanged() {
      events.emit('caretchange');
    },

    toggleBlock(tagName: string) {
      applyToggler(tagName, editor, toggleBlock);
    },

    toggleInline(tagName: string) {
      const range = Rng.currentRange();
      if (!range) {
        return;
      }
      if (range.collapsed) {
        activeTags.toggleInlineFuture(tagName, () => Rng.setCurrentSelection(range));
      } else {
        applyToggler(tagName, editor, toggleInline);
      }
    },

    toggleList(tagName: 'ol' | 'ul') {
      applyToggler(tagName, editor, toggleList);
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

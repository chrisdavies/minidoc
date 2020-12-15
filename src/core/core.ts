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
import { caretTracker, trackSelectionChange } from './caret-tracker';
import * as Disposable from '../disposable';
import { MinidocPlugin, MinidocEditor, MinidocEvent } from '../types';
import { debounce } from '../util';

interface CoreOptions {
  doc: string;
  plugins: MinidocPlugin[];
  placeholder: string;
}

function applyToggler(s: string, editor: MinidocEditor, toggler: (s: string, r: Range) => Range) {
  const range = Rng.currentRange();
  if (range) {
    editor.undoHistory.commit();
    Rng.setCurrentSelection(toggler(s, range));
    editor.undoHistory.commit();
  }
}

function trimTextNodes(el: Element) {
  Array.from(el.childNodes).forEach((n) => {
    if (!Dom.isElement(n)) {
      n.remove();
    }
  });
  return el;
}

const scrollToCaret = debounce(() => {
  const node = document.getSelection()?.focusNode;
  Dom.isElement(node) && node.scrollIntoView();
});

export function createCoreEditor({ doc, plugins, placeholder }: CoreOptions): MinidocEditor {
  const events = createEmitter<MinidocEvent>();

  const el = trimTextNodes(
    h('div.minidoc-editor', {
      contentEditable: true,
      innerHTML: doc,
    }),
  );

  const updatePlaceholder = () => {
    // We'll show / hide the placeholder based on input.
    const placeholderText =
      (el.childElementCount <= 1 && Dom.isEmpty(el, true) && placeholder) || '';
    if (placeholderText !== el.getAttribute('placeholder')) {
      el.setAttribute('placeholder', placeholderText);
    }
  };

  updatePlaceholder();

  const activeTags = activeTagTracker({
    ...events,
    root: el,
  });

  let editor: MinidocEditor = {
    root: el,

    isActive: activeTags.isActive,

    on(evt: MinidocEvent, handler: () => any) {
      return events.on(evt, handler);
    },

    emit: events.emit,

    undoHistory: undoRedo(
      { doc: el.innerHTML, ctx: Rng.emptyDetachedRange() },
      () => {
        // Serialize should be an immutable operation, but there was a strange case
        // in Safari where it screwed up the range, probably due to calling normalize.
        // So, we have to serialize *prior* to getting the range. :/
        const doc = editor.serialize();
        const range = Rng.currentRange();
        const ctx = (range && Rng.detachFrom(range, el)) || Rng.emptyDetachedRange();
        return { doc, ctx };
      },
      () => editor.emit('undocapture'),
    ),

    undo() {
      patchDoc(editor.undoHistory.undo(), editor);
    },

    redo() {
      patchDoc(editor.undoHistory.redo(), editor);
    },

    caretChanged() {
      events.emit('caretchange');
      scrollToCaret();
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

    dispose() {},
  };

  // When the selection changes within the element,
  // we'll fire off a selection change event.
  trackSelectionChange(el, editor.caretChanged);

  editor = plugins.reduce((acc, p) => p(acc), editor);
  editor.beforeMount(el);

  // Track caret position for undo / redo history.
  caretTracker(editor);

  // Wire up the disposable system and track edit events. We ignore
  // edits that are caused by an undo / redo
  editor.dispose = Disposable.initialize(editor.root, () => {
    updatePlaceholder();
    editor.emit('edit');
  }).dispose;

  return editor;
}

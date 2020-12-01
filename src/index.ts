import * as Dom from './dom';
import * as Rng from './range';
import { createEmitter } from './emitter';
import { defaultPlugin } from './default-plugin';
import { listPlugin } from './list';

const plugins = [listPlugin, defaultPlugin];

type MinidocEvent = 'caretchange';

function trackSelectionChange(el: HTMLDivElement, handler: () => void) {
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

function computeActiveTags(activeTags: Set<string>, root: HTMLDivElement, child: Node) {
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

export function minidoc(el: HTMLDivElement) {
  const events = createEmitter<MinidocEvent>();
  // The tag names within which the caret is located
  const activeTags: Set<string> = new Set<string>();

  el.contentEditable = 'true';
  el.classList.add('minidoc');
  // Sanitize the editor root. Vanilla text nodes are not allowed as leafs.
  Array.from(el.childNodes).forEach((n) => Dom.isText(n) && n.remove());
  // Ensure the editor root has at least one editable element in it.
  Dom.$makeEditable(el);

  // When the selection changes within the element,
  // we'll fire off a selection change event.
  trackSelectionChange(el, () => {
    computeActiveTags(activeTags, el, Rng.toNode(Rng.currentRange()!));
    events.emit('caretchange');
  });

  const editor = {
    root: el,

    isWithin(tag: string) {
      return activeTags.has(tag);
    },

    activeTags(): Iterable<string> {
      return activeTags;
    },

    on(evt: MinidocEvent, handler: () => any) {
      return events.on(evt, handler);
    },
  };

  Dom.on(el, 'keydown', (e) => {
    for (let p of plugins) {
      p.onKeydown?.(e, editor);
      if (e.defaultPrevented) {
        return;
      }
    }
  });

  return editor;
}

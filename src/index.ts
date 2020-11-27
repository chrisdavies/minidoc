import * as Dom from './dom';
import * as Rng from './range';
import { createEmitter } from './emitter';
import { modes, Mode } from './modes';

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
  let mode: Mode = modes.default;

  el.contentEditable = 'true';
  el.classList.add('minidoc');

  // When the selection changes within the element,
  // we'll fire off a selection change event.
  trackSelectionChange(el, () => {
    mode = modes.default;
    computeActiveTags(activeTags, el, Rng.toNode(Rng.currentRange()!)).forEach((tag) => {
      mode = modes[tag] || mode;
    });
    events.emit('caretchange');
  });

  Dom.on(el, 'keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      (mode.onEnter ?? modes.default.onEnter)?.();
    }
  });

  return {
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
}

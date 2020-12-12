/**
 * This file contains logic for tracking active tags. That is, the tags
 * within which the current selection sits. It also tracks toggled tags,
 * that is if the user toggles an inline style on a collapsed range.
 */
import * as Dom from '../dom';
import * as Rng from '../range';
import { toggleInline } from '../default-plugin';

function normalizeTagName(tagName: string) {
  tagName = tagName.toUpperCase();
  if (tagName === 'B') {
    return 'STRONG';
  } else if (tagName === 'I') {
    return 'EM';
  }
  return tagName;
}

export function activeTagTracker(editor: Eventable<MinidocEvent> & Rootable) {
  // The tags within which the current selection resides
  const activeTags = new Set<string>();
  // The tags which are toggled (will affect the next input)
  const toggledTags = new Set<string>();
  // When we're toggling an inline tag, we trigger a selection change
  // which in turn clears the toggled tags. So, we need to ignore that
  // particular selection change. This flag is how we do that.
  let isToggling = false;

  // When the editor's caret / selection changes, we need to
  // recompute the active tags and reset the toggled tags.
  editor.on('caretchange', () => {
    if (isToggling) {
      return;
    }
    const range = Rng.currentRange();
    if (!range) {
      return;
    }
    let child = Rng.toNode(range);
    activeTags.clear();
    toggledTags.clear();
    while (true) {
      const parent = child.parentElement;
      if (!parent || Dom.isRoot(parent)) {
        break;
      }
      activeTags.add(normalizeTagName(parent.tagName));
      child = parent;
    }
  });

  // If the user enters anything and we have some toggled tags,
  // we need to apply the toggled tags.
  Dom.on(editor.root, 'keypress', (e) => {
    if (!toggledTags.size) {
      return;
    }
    let range = Rng.currentRange()!;
    if (!range) {
      return;
    }
    e.preventDefault();
    const node = document.createTextNode(e.key);
    range.deleteContents();
    range.insertNode(node);
    toggledTags.forEach((k) => {
      range = toggleInline(k, range);
    });
    range.collapse();
    Rng.setCurrentSelection(range);
    toggledTags.clear();
  });

  return {
    /**
     * Determine if the specified tag is active or inactive, e.g. for
     * determining whether or not a toolbar action should be highlighted.
     */
    isActive(tagName: string) {
      const normalized = normalizeTagName(tagName);
      return activeTags.has(normalized) === !toggledTags.has(normalized);
    },

    /**
     * Toggle the specified tag the next time the user types.
     */
    toggleInlineFuture(tagName: string, afterToggle: () => void) {
      isToggling = true;
      try {
        const normalized = normalizeTagName(tagName);
        toggledTags.has(normalized) ? toggledTags.delete(normalized) : toggledTags.add(normalized);
        afterToggle();
      } finally {
        // We have to do this in a timeout to allow the selection change
        // events to propagate before we reset the flag.
        setTimeout(() => {
          isToggling = false;
        });
      }
    },
  };
}

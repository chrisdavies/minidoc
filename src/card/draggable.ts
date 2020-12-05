import * as Dom from '../dom';
import { h } from '../dom';
import { debounce } from '../util';

let draggingEl: Element | undefined;

/**
 * Make the specified element draggable, and understood by this drop tracker.
 * The el is probably a card.
 */
export function makeDraggable(el: Element) {
  el.setAttribute('draggable', 'true');
  el.addEventListener('dragstart', (e: any) => {
    const tmp = el as HTMLElement;
    const opacity = tmp.style.opacity;
    tmp.style.opacity = '0.2';
    setTimeout(() => (tmp.style.opacity = opacity), 10);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text', 'mini-card');
    draggingEl = Dom.findLeaf(el);
  });
  return el;
}

/**
 * Enable drag / drop reordering for direct, draggable children of the specified element.
 */
export function enableDragDrop(el: Element) {
  const dropTarget = h<HTMLElement>('drop-target.minidoc-drop-target');
  let prevY = 0;

  const repositionDropTarget = debounce((e: any) => {
    if (!draggingEl || e.target.tagName === 'DROP-TARGET') {
      return;
    }
    const leaf = Dom.findLeaf(e.target);
    if (!leaf) {
      return;
    }

    const clientY = e.clientY;

    if (!draggingEl.contains(e.target) && prevY !== clientY) {
      const aboveEl = prevY >= clientY ? leaf : leaf.nextElementSibling || undefined;
      if (aboveEl) {
        aboveEl.parentElement?.insertBefore(draggingEl, aboveEl);
      } else {
        el.append(draggingEl);
      }
    }

    prevY = clientY;
    if (!dropTarget.isConnected) {
      const leafBounds = draggingEl.getBoundingClientRect();
      dropTarget.style.width = `${leafBounds.width}px`;
      dropTarget.style.left = `${leafBounds.left}px`;
      dropTarget.style.top = `${leafBounds.top - 2}px`;
      dropTarget.style.height = `${leafBounds.height + 4}px`;
      (draggingEl as HTMLElement).style.visibility = 'hidden';
      document.body.appendChild(dropTarget);
    } else {
      dropTarget.style.top = `${draggingEl.getBoundingClientRect().top - 2}px`;
    }
  }, 50);

  function finishDrag(e: Event) {
    e.preventDefault();
    dropTarget.remove();
    if (draggingEl) {
      (draggingEl as HTMLElement).style.visibility = 'visible';
      draggingEl = undefined;
    }
  }

  el.addEventListener('dragover', (e) => {
    e.preventDefault();
    repositionDropTarget(e);
  });

  el.addEventListener('dragenter', (e) => {
    e.preventDefault();
    repositionDropTarget(e);
  });

  dropTarget.addEventListener('dragover', (e) => e.preventDefault());

  el.addEventListener('dragend', finishDrag);
  el.addEventListener('drop', finishDrag);
  dropTarget.addEventListener('dragend', finishDrag);
  dropTarget.addEventListener('drop', finishDrag);
}

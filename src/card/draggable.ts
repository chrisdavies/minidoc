import * as Dom from '../dom';
import { h } from '../dom';
import { debounce } from '../util';

// We show a dragging line in the editor, so we'll use a transparent gif to hide the drag image,
// which I find to be more of a distraction than a help.
const dragImg = new Image(1, 1);
dragImg.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';

/**
 * Make the specified element draggable, and understood by this drop tracker.
 * The el is probably a card.
 */
export function makeDraggable(el: Element) {
  el.setAttribute('draggable', 'true');
  return el;
}

/**
 * Enable drag / drop reordering for direct, draggable children of the specified element.
 */
export function enableDragDrop(el: Element) {
  // The element being dragged
  let draggingEl: Element | undefined;

  // The drop target preview, showing where draggingEl will be placed when drag completes
  const dropTarget = h<HTMLElement>('drop-target.minidoc-drop-target');

  const repositionDropTarget = debounce((e: DragEvent) => {
    if (!draggingEl) {
      return;
    }

    // Find the elment above which we should insert the drop target. If the mouse
    // is above the midpoint of an element, we'll place the drop target above
    // otherwise, we'll put it below.
    // This is pretty inefficient, but accurate. If we find it's a perf problem
    // on old machines, we can cache the element sizes once when drag starts.
    let above: Element | null = el.firstElementChild;
    above?.clientTop;
    while (above) {
      const bounds = above.getBoundingClientRect();
      if (bounds.top + bounds.height / 2 > e.clientY) {
        break;
      }
      above = above.nextElementSibling;
    }

    el.insertBefore(dropTarget, above);
  }, 50);

  el.addEventListener('dragstart', (e: any) => {
    draggingEl = Dom.findLeaf(e.target);
    if (!draggingEl) {
      return;
    }

    // We attach event listeners to the document because it's pretty easy to
    // drag the element outside of the editor, but you still want to update the
    // drop position even so.
    const done: Array<() => void> = [];
    const off = () => done.forEach((f) => f());
    done.push(
      Dom.on(document, 'dragover', (e) => {
        e.preventDefault();
        repositionDropTarget(e);
      }),
    );
    done.push(Dom.on(document, 'dragend', off));
    done.push(Dom.on(document, 'mousemove', off));

    e.dataTransfer!.setData('text', 'mini-card');
    e.dataTransfer!.setDragImage(dragImg, 0, 0);
    (draggingEl as HTMLElement).style.opacity = '0.2';
  });

  function finishDrag(e: Event) {
    e.preventDefault();
    if (draggingEl) {
      dropTarget.isConnected && dropTarget.replaceWith(draggingEl);
      (draggingEl as HTMLElement).style.opacity = '1';
      draggingEl = undefined;
    }
    dropTarget.remove();
  }

  el.addEventListener('dragover', (e) => {
    e.preventDefault();
    repositionDropTarget(e);
  });

  el.addEventListener('dragenter', (e) => {
    e.preventDefault();
    repositionDropTarget(e);
  });

  el.addEventListener('dragend', finishDrag);
  el.addEventListener('drop', finishDrag);
}

import * as Dom from '../dom';
import { h } from '../dom';
import { MindocDragDrop, MinidocDropHandler } from '../types';
import { debounce } from '../util';

// We show a dragging line in the editor, so we'll use a transparent gif to hide the drag image,
// which I find to be more of a distraction than a help.
const dragImg = new Image(1, 1);
dragImg.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';

/**
 * Enable drag / drop reordering for direct, draggable children of the specified element.
 */
export function enableDragDrop(el: Element, onChange: () => void): MindocDragDrop {
  // The drop target preview, showing where draggingEl will be placed when drag completes
  const dropTarget = h<HTMLElement>('drop-target.minidoc-drop-target');

  let onDrop: undefined | MinidocDropHandler;

  const dragDrop: MindocDragDrop = {
    isDragging: false,
    begin(e, handler) {
      dragDrop.isDragging = true;
      onDrop = handler;

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

      e.dataTransfer!.setData('text', 'minidoc');
      e.dataTransfer!.setDragImage(dragImg, 0, 0);
    },
  };

  const repositionDropTarget = debounce((e: DragEvent) => {
    if (!dragDrop.isDragging) {
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

  function finishDrag(e: Event) {
    if (onDrop) {
      const result = onDrop?.(e as DragEvent, dropTarget);
      result && dropTarget.replaceWith(result);
      onChange?.();
    }
    e.preventDefault();
    dragDrop.isDragging = false;
    onDrop = undefined;
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

  return dragDrop;
}

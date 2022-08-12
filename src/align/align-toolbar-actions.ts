import { MinidocToolbarAction } from '../toolbar';
import * as Rng from '../range';
import * as Dom from '../dom';
import { AlignMenu, mkico } from './align-menu';

function currentDirection() {
  const node = Rng.currentNode();
  const el = node && Dom.findLeaf(node);
  return (el && el.getAttribute('data-align')) || 'left';
}

function toolbarIcon(direction: string) {
  return `<ico-align data-val=${direction}>${mkico(direction)}</ico-align>`;
}

export const alignToolbarAction: MinidocToolbarAction = {
  id: 'l-align',
  label: 'Align left',
  html: toolbarIcon('left'),
  run: (t) => t.toolbar.setMenu(AlignMenu(t)),
  isActive: (t) => {
    const direction = currentDirection();
    const ico = t.toolbar.root.querySelector<HTMLElement>('ico-align');
    if (ico?.parentElement && ico.dataset.val !== direction) {
      ico.parentElement.innerHTML = toolbarIcon(direction);
    }
    return direction !== 'left';
  },
};

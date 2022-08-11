import { MinidocToolbarAction } from '../toolbar';
import * as Rng from '../range';
import * as Dom from '../dom';

const mkico = (shift: number) =>
  `<svg fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" width="16" height="16"><path d="M ${shift} 3 L ${
    shift + 6
  } 3 M 2 8 L 14 8 M ${shift} 13 L ${shift + 6} 13"></path></svg>`;
const icoLeft = mkico(2);
const icoCenter = mkico(5);
const icoRight = mkico(8);

function alignment() {
  const node = Rng.currentNode();
  const el = node && Dom.findLeaf(node);
  return el && el.getAttribute('data-align');
}

export const alignLeftToolbarAction: MinidocToolbarAction = {
  id: 'l-align',
  label: 'Align left',
  html: icoLeft,
  run: (t) => t.align('left'),
  isActive: () => !alignment(),
};

export const alignCenterToolbarAction: MinidocToolbarAction = {
  id: 'c-align',
  label: 'Align center',
  html: icoCenter,
  run: (t) => t.align('center'),
  isActive: () => alignment() === 'center',
};

export const alignRightToolbarAction: MinidocToolbarAction = {
  id: 'r-align',
  label: 'Align right',
  html: icoRight,
  run: (t) => t.align('right'),
  isActive: () => alignment() === 'right',
};

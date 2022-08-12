import * as Rng from '../range';
import { Submenu, MinidocToolbarEditor, ToolbarButton } from '../toolbar';

const iconShift: Record<string, number> = {
  left: 2,
  center: 5,
  right: 8,
};

export function mkico(direction: string) {
  const shift = iconShift[direction];
  return `<svg fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" width="16" height="16"><path d="M ${shift} 3 L ${
    shift + 6
  } 3 M 2 8 L 14 8 M ${shift} 13 L ${shift + 6} 13"></path></svg>`;
}

function findLeafs() {
  const range = Rng.currentRange();
  if (!range) {
    return;
  }
  return Rng.findLeafs(range);
}

export function align(direction: string, leafs?: Element[]) {
  leafs = leafs || findLeafs();
  if (!leafs) {
    return;
  }
  const attr = 'data-align';
  leafs.forEach((el) =>
    direction === 'left' ? el.removeAttribute(attr) : el.setAttribute(attr, direction),
  );
}

export function AlignMenu(editor: MinidocToolbarEditor) {
  const range = Rng.currentRange();
  if (!range) {
    return;
  }
  const leafs = Rng.findLeafs(range);
  if (!leafs.length) {
    return;
  }

  function alignButton(direction: string) {
    return ToolbarButton(editor, {
      label: `Text ${direction}`,
      html: mkico(direction),
      run() {
        editor.captureChange(() => align(direction, leafs));
        editor.toolbar.setMenu();
        range && Rng.setCurrentSelection(range);
      },
    });
  }

  const menu = Submenu({
    children: [alignButton('left'), alignButton('center'), alignButton('right')],
    editor,
  });

  return menu;
}

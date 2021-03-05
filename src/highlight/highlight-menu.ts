import * as Rng from '../range';
import { h } from '../dom';
import { Submenu, MinidocToolbarEditor, ToolbarButton } from '../toolbar';
import { unapply } from '../inline-toggle';

const palette = ['#FECACA', '#FDE68A', '#A7F3D0', '#BFDBFE', '#DDD6FE'];

export function HighlightMenu(editor: MinidocToolbarEditor) {
  const range = Rng.currentRange();
  if (!range || range.collapsed) {
    return;
  }

  const hide = () => editor.toolbar.setMenu(undefined);

  const highlight = (color: string) => {
    try {
      const ranges = Rng.inlinableRanges(range);
      ranges.forEach((r) => {
        unapply('mini-color', r);
        const el = h('mini-color', { style: `background-color: ${color}` }, r.extractContents());
        r.insertNode(el);
      });
      ranges.length && Rng.setCurrentSelection(ranges[0]).collapse(true);
    } finally {
      hide();
    }
  };

  const clearHighlight = () => {
    try {
      const ranges = Rng.inlinableRanges(range);
      ranges.forEach((r) => {
        unapply('mini-color', r);
      });
      ranges.length && Rng.setCurrentSelection(ranges[0]).collapse(true);
    } finally {
      hide();
    }
  };

  const menu = Submenu({
    children: [
      ...palette.map((color) =>
        ToolbarButton(editor, {
          label: 'Highlight',
          html: `<span class="minidoc-highlight-color" style="background-color: ${color}"></span>`,
          run: () => highlight(color),
        }),
      ),
      ToolbarButton(editor, {
        label: 'Clear',
        html: `<span class="minidoc-clear-highlight"></span>`,
        run: () => clearHighlight(),
      }),
    ],
    editor,
  });

  return menu;
}

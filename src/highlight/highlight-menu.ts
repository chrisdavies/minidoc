import * as Rng from '../range';
import { h } from '../dom';
import { Submenu, MinidocToolbarEditor, ToolbarButton } from '../toolbar';
import { unapply } from '../inline-toggle';

const palette: Record<string, string> = {
  purple: 'Purple',
  red: 'Red',
  yellow: 'Yellow',
  green: 'Green',
  blue: 'Blue',
};

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
        unapply('mark', r);
        const el = h('mark', { 'data-bg': color }, r.extractContents());
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
        unapply('mark', r);
      });
      ranges.length && Rng.setCurrentSelection(ranges[0]).collapse(true);
    } finally {
      hide();
    }
  };

  const menu = Submenu({
    children: [
      ...Object.keys(palette).map((color) =>
        ToolbarButton(editor, {
          label: palette[color],
          html: `<span class="minidoc-toolbar-color" data-bg="${color}"></span>`,
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

import * as Rng from '../range';
import { h, closest } from '../dom';
import { Submenu, MinidocToolbarEditor, ToolbarButton } from '../toolbar';
import { unapply } from '../inline-toggle';
import { compose } from '../util';

const bgColors: Record<string, string> = {
  Purple: 'purple',
  Red: 'red',
  Yellow: 'yellow',
  Green: 'green',
  Blue: 'blue',
};

const fgColors: Record<string, string> = {
  Purple: '#9333ea',
  Red: '#e11d48',
  Yellow: '#d97706',
  Green: '#16a34a',
  Blue: '#2563eb',
};

const namedBg: Record<string, string> = {
  red: '#fecaca',
  yellow: '#fde68a',
  green: '#a7f3d0',
  blue: '#bfdbfe',
  purple: '#ddd6fe',
};

function transformTextColorEl(n: HTMLElement) {
  n.style.color = n.dataset.fg || '';
  return n;
}

function transformTextBgEl(n: HTMLElement) {
  n.style.background = namedBg[n.dataset.bg || ''] || n.dataset.bg || '';
  return n;
}

export function initTextColors(editor: MinidocToolbarEditor) {
  editor.scrub = compose(editor.scrub, (node) => {
    const parentNode = node as unknown as ParentNode;
    if (parentNode.querySelectorAll) {
      parentNode.querySelectorAll<HTMLElement>('text-color').forEach(transformTextColorEl);
    }
    return node;
  });
}

function makeMenu(opts: {
  colors: Record<string, string>;
  clearBg: string;
  tag: string;
  prop: string;
  transform?: typeof transformTextColorEl;
  renderColorIcon(color: string): string;
}) {
  return function ColorMenu(editor: MinidocToolbarEditor) {
    const range = Rng.currentRange();
    if (!range || range.collapsed) {
      return;
    }

    const hide = () => editor.toolbar.setMenu(undefined);

    const applyColor = (color: string) => {
      try {
        const ranges = Rng.inlinableRanges(range);
        ranges.forEach((r) => {
          unapply(opts.tag, r);
          let el = h(opts.tag, { [opts.prop]: color }, r.extractContents());
          if (opts.transform) {
            el = opts.transform(el);
          }
          r.insertNode(el);
        });
        ranges.length && Rng.setCurrentSelection(ranges[0]);
      } finally {
        hide();
      }
    };

    const clearColor = () => {
      try {
        const ranges = Rng.inlinableRanges(range);
        ranges.forEach((r) => {
          unapply(opts.tag, r);
        });
        ranges.length && Rng.setCurrentSelection(ranges[0]);
      } finally {
        hide();
      }
    };

    const existingNode =
      Rng.querySelector(`[${opts.prop}]`, range) || closest(`[${opts.prop}]`, Rng.toNode(range));
    let customColor = existingNode?.getAttribute(opts.prop) || '';
    const menu = Submenu({
      children: [
        ...Object.entries(opts.colors).map(([label, color]) =>
          ToolbarButton(editor, {
            label,
            html: opts.renderColorIcon(color),
            run: () => applyColor(color),
          }),
        ),
        ToolbarButton(editor, {
          label: 'Clear',
          html: `<span class="minidoc-clear-highlight" style="background: ${opts.clearBg}"></span>`,
          run: () => clearColor(),
        }),
        h('input.minidoc-toolbar-txt', {
          placeholder: '#333',
          autofocus: 'true',
          value: customColor,
          oninput(e: any) {
            customColor = e.target.value;
          },
          onkeydown(e: KeyboardEvent) {
            if (e.key === 'Enter') {
              e.preventDefault();
              applyColor(customColor);
            }
          },
        }),
      ],
      editor,
    });

    return menu;
  };
}

export const TextColorMenu = makeMenu({
  colors: fgColors,
  clearBg: 'currentColor',
  tag: 'text-color',
  prop: 'data-fg',
  transform: transformTextColorEl,
  renderColorIcon(color) {
    return `<span class="minidoc-toolbar-color" style="background: ${color}"></span>`;
  },
});

export const HighlightMenu = makeMenu({
  colors: bgColors,
  clearBg: 'white',
  tag: 'mark',
  prop: 'data-bg',
  transform: transformTextBgEl,
  renderColorIcon(color: string) {
    return `<span class="minidoc-toolbar-color" data-bg="${color}"></span>`;
  },
});

import { h } from '../dom';
import { MinidocToolbarEditor } from './toolbar-types';
import { ToolbarButton } from './toolbar-button';

const IcoClose = `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
</svg>`;

export function Submenu({
  children,
  isDismissable = true,
  editor,
}: {
  children: Element[];
  isDismissable?: boolean;
  editor: MinidocToolbarEditor;
}) {
  return h(
    '.minidoc-submenu',
    h(
      'nav.minidoc-submenu-content',
      children,
      isDismissable && h('span.minidoc-toolbar-divider'),
      isDismissable &&
        ToolbarButton(editor, {
          label: 'Close',
          html: `<span class="minidoc-btn-fadein">${IcoClose}</span>`,
          run: () => editor.toolbar.setMenu(undefined),
        }),
    ),
  );
}

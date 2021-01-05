import { h } from '../dom';
import { MinidocToolbarEditor } from './toolbar-types';
import { ToolbarButton } from './toolbar-button';

const IcoClose = `<svg fill="currentColor" viewBox="0 0 24 24">
  <path d="M12 0c-6.627 0-12 5.373-12 12s5.373 12 12 12 12-5.373 12-12-5.373-12-12-12zm4.151 17.943l-4.143-4.102-4.117 4.159-1.833-1.833 4.104-4.157-4.162-4.119 1.833-1.833 4.155 4.102 4.106-4.16 1.849 1.849-4.1 4.141 4.157 4.104-1.849 1.849z" />
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
      isDismissable &&
        ToolbarButton(editor, {
          label: 'Close',
          html: `<span class="minidoc-btn-fadein">${IcoClose}</span>`,
          run: () => editor.toolbar.setMenu(undefined),
        }),
    ),
  );
}

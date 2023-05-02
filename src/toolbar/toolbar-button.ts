import { h } from '../dom';
import { MinidocToolbarAction, MinidocToolbarEditor } from './toolbar-types';

export function ToolbarButton(
  editor: MinidocToolbarEditor,
  { label, isActive, html, run }: Pick<MinidocToolbarAction, 'label' | 'isActive' | 'html' | 'run'>,
) {
  let lastActive: Element | null;
  const btn = h('button.minidoc-toolbar-btn', {
    refreshState:
      isActive &&
      ((editor: MinidocToolbarEditor) =>
        btn.classList.toggle('minidoc-toolbar-btn-active', isActive(editor))),
    onmousedown: () => {
      lastActive = document.activeElement;
    },
    onclick() {
      run(editor);
      (lastActive as HTMLElement)?.focus();
    },
    type: 'button',
    'aria-label': label,
    innerHTML: html,
  });
  return btn;
}

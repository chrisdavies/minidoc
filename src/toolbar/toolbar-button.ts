import { h } from '../dom';

export function ToolbarButton(
  editor: MinidocToolbarEditor,
  { label, isActive, html, run }: Pick<MinidocToolbarAction, 'label' | 'isActive' | 'html' | 'run'>,
) {
  const btn = h('button.minidoc-toolbar-btn', {
    refreshState:
      isActive &&
      ((editor: MinidocToolbarEditor) =>
        btn.classList.toggle('minidoc-toolbar-btn-active', isActive(editor))),
    onclick: () => run(editor),
    'aria-label': label,
    innerHTML: html,
  });
  return btn;
}

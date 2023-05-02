import { h } from '../dom';
import { MinidocToolbarAction, MinidocToolbarEditor } from './toolbar-types';

export function ToolbarButton(
  editor: MinidocToolbarEditor,
  { label, isActive, html, run, onMouseDown }: Pick<MinidocToolbarAction, 'label' | 'isActive' | 'html' | 'run' | 'onMouseDown'>,
) {
  const btn = h('button.minidoc-toolbar-btn', {
    refreshState:
      isActive &&
      ((editor: MinidocToolbarEditor) =>
        btn.classList.toggle('minidoc-toolbar-btn-active', isActive(editor))),
    onmousedown: onMouseDown,
    onclick() {
      run(editor);
    },
    type: 'button',
    'aria-label': label,
    innerHTML: html,
  });
  return btn;
}

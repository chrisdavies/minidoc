import * as Rng from '../range';
import { onMount } from '../disposable';
import { h } from '../dom';
import { debounce } from '../util';
import { Sticky } from './sticky';
import { ToolbarButton } from './toolbar-button';

export function createToolbar(editor: MinidocCoreEditor, actions: MinidocToolbarAction[]) {
  const container = h('header.minidoc-toolbar');
  const root = Sticky(container);
  const toolbar: MinidocToolbar = {
    root,
    setMenu(el?: Element) {
      container.firstElementChild?.replaceWith(el || defaultMenu);
    },
  };

  const toolbarEditor = {
    ...editor,
    toolbar,
  };
  const btns = actions.map((b) => ToolbarButton(toolbarEditor, b));
  const refreshButtons = debounce(() => {
    const node = Rng.currentNode();
    node && btns.forEach((b: any) => b.refreshState?.(toolbarEditor));
  });
  const defaultMenu = h('.minidoc-default-menu', btns);

  container.append(defaultMenu);

  onMount(root, () => editor.on('caretchange', refreshButtons));

  return toolbar;
}

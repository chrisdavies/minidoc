import * as Rng from '../range';
import { h } from '../dom';
import { debounce } from '../util';
import { ToolbarButton } from './toolbar-button';
import * as Disposable from '../disposable';

export function createToolbar({
  editor,
  actions,
}: {
  editor: MinidocEditor;
  actions: MinidocToolbarAction[];
}) {
  const toolbarEditor = editor as MinidocToolbarEditor;
  const root = h('header.minidoc-toolbar');
  toolbarEditor.toolbar = {
    root,
    setMenu(el?: Element) {
      root.firstElementChild?.replaceWith(el || defaultMenu);
    },
    dispose() {},
  };
  const btns = actions.map((b) => {
    b.init && b.init(toolbarEditor);
    return ToolbarButton(toolbarEditor, b);
  });
  const refreshButtons = debounce(() => {
    const node = Rng.currentNode();
    node && btns.forEach((b: any) => b.refreshState?.(toolbarEditor));
  });
  const defaultMenu = h('.minidoc-default-menu', btns);

  root.append(defaultMenu);

  Disposable.onMount(root, () => editor.on('caretchange', refreshButtons));

  toolbarEditor.toolbar.dispose = Disposable.initialize(
    toolbarEditor.toolbar.root,
    () => {},
  ).dispose;

  return toolbarEditor.toolbar;
}

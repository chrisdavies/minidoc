import { createCoreEditor } from './core';
import { createToolbar } from './toolbar';
import * as Disposable from './disposable';
import { h } from './dom';

export function minidoc(doc: string): MinidocEditor {
  const editor = createCoreEditor(doc);
  const toolbar = createToolbar(editor);
  const wrapper = Disposable.initialize(h('.minidoc-container'));

  wrapper.append(toolbar.root, editor.root);

  return {
    ...editor,
    root: wrapper,
    dispose: wrapper.dispose,
  };
}

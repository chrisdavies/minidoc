import { createCoreEditor } from './core';
import { createToolbar } from './toolbar';
import { linkHoverPreview } from './link';
import * as Disposable from './disposable';
import { h } from './dom';

export function minidoc(doc: string): MinidocEditor {
  const editor = createCoreEditor(doc);
  const toolbar = createToolbar(editor);
  const wrapper = Disposable.initialize(h('.minidoc-container'));

  // Attach behaviors to the editor prior to mounting it...
  linkHoverPreview(editor.root);

  wrapper.append(toolbar.root, editor.root);

  return {
    ...editor,
    root: wrapper,
    dispose: wrapper.dispose,
  };
}

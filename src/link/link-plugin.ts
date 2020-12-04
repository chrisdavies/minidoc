import * as Dom from '../dom';
import { hasToolbar } from '../toolbar';
import { LinkMenu } from './link-menu';

export const linkPlugin: MinidocPlugin = (editor) => {
  Dom.on(editor.root, 'keydown', (e) => {
    if (
      !e.defaultPrevented &&
      (e.metaKey || e.ctrlKey) &&
      hasToolbar(editor) &&
      e.code === 'KeyK'
    ) {
      e.preventDefault();
      editor.toolbar.setMenu(LinkMenu(editor));
    }
  });
  return editor;
};

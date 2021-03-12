/**
 * This module contains minidoc middleware that handles file paste
 * and drop. When a file is pasted / dropped into the document,
 * the drop handler is invoked.
 */

import * as Dom from '../dom';
import * as Rng from '../range';
import { MinidocCore } from '../minidoc';
import { EditorMiddleware } from '../types';

type FileDropHandler = (opts: { editor: MinidocCore; files: FileList }) => void;

/**
 * Add file drop and paste support.
 */
export const fileDrop = (handler: FileDropHandler): EditorMiddleware => (next, editor) => {
  const core = editor as MinidocCore;

  // Paste files
  Dom.on(editor.root, 'paste', (e) => {
    if (!e.defaultPrevented && e.clipboardData?.files.length) {
      e.preventDefault();
      handler({ editor: core, files: e.clipboardData.files });
    }
  });

  // The user drags files, we want to show the drop indicator,
  // and we'll handle the drop ourselves.
  Dom.on(editor.root, 'dragover', (e) => {
    if (
      !core.isDragging &&
      e.dataTransfer &&
      Array.from(e.dataTransfer.items).some((x) => x.kind === 'file')
    ) {
      e.preventDefault();
      core.beginDragDrop(e, (e, target) => {
        e.preventDefault();
        Rng.setCaretAtStart(target);
        const files = e.dataTransfer?.files;
        if (files?.length) {
          handler({ editor: core, files });
        }
        return undefined;
      });
    }
  });

  return next(editor);
};

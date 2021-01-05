/**
 * This module handles all media elements in the editor (video, image, audio, pdf, files, etc).
 * It attaches the file drag / drop and paste behaviors, and adds the insertMedia editor method.
 */

import * as Dom from '../dom';
import * as Rng from '../range';
import { h } from '../dom';
import { renderUploader, Uploader, UploadRef } from './uploader';
import { onMount } from '../disposable';
import { EditorMiddlewareMixin, MinidocBase } from '../types';
import { Cardable } from '../card';
import { DragDroppable } from '../drag-drop';

export interface Mediable {
  insertMedia(file: File): void;
}

interface MediaCardOpts {
  upload: Uploader;
  renderMedia: MediaRenderer;
}

export interface MediaCardState {
  url: string;
  type: string;
  name: string;
  caption?: string;
}

export type MediaRenderer = (state: MediaCardState) => Element;

/**
 * We track media references in order to allow file uploads to exist
 * across undo / redo operations.
 */
function uploaderRefs() {
  let nextId = 0;
  const refs: { [k: string]: UploadRef } = {};

  return {
    add(opts: Omit<UploadRef, 'id'>) {
      --nextId;
      const id = String(nextId);
      refs[id] = { ...opts, id };
      return id;
    },
    get(id: string) {
      return refs[id];
    },
  };
}

export const mediaMiddleware = ({
  upload,
  renderMedia,
}: MediaCardOpts): EditorMiddlewareMixin<Mediable> => (next, editor) => {
  const result = editor as MinidocBase & Mediable & Cardable & DragDroppable;
  const refs = uploaderRefs();

  function insertMedia(file: File) {
    result.insertCard('media', {
      uploadRef: refs.add({ file }),
      name: file.name,
      type: file.type,
    });
  }

  result.insertMedia = insertMedia;
  result.defineCard({
    type: 'media',
    render(opts) {
      const state = opts.state;
      const uploader = state.uploadRef ? refs.get(state.uploadRef) : undefined;
      let url = state.url || uploader?.url;
      const el = h('div.media-card-unknown');

      if (uploader && uploader.file && !url) {
        const fileUrl = URL.createObjectURL(uploader.file);
        url = fileUrl;
        onMount(el, () => () => URL.revokeObjectURL(fileUrl));
      }

      const mediaEl = renderMedia({
        ...state,
        url,
      });

      Dom.appendChildren(
        [
          mediaEl,
          uploader &&
            renderUploader({
              upload,
              ref: uploader,
              onError(err) {
                uploader.error = err;
                mediaEl.replaceWith(h('p.mediadoc-error', err));
              },
            }),
        ],
        el,
      );

      return el;
    },
  });

  // Paste files
  Dom.on(editor.root, 'paste', (e) => {
    if (!e.defaultPrevented && e.clipboardData?.files.length) {
      e.preventDefault();
      insertMedia(e.clipboardData.files[0]);
    }
  });

  // The user drags files, we want to show the drop indicator,
  // and we'll handle the drop ourselves.
  Dom.on(editor.root, 'dragover', (e) => {
    if (
      !result.isDragging &&
      e.dataTransfer &&
      Array.from(e.dataTransfer.items).some((x) => x.kind === 'file')
    ) {
      e.preventDefault();
      result.beginDragDrop(e, (e, target) => {
        e.preventDefault();
        const file = e.dataTransfer?.files[0];
        if (file) {
          Rng.setCaretAtStart(target);
          insertMedia(file);
        }
      });
    }
  });

  return next(result);
};

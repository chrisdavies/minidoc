/**
 * This module performs file upload and renders the upload progress. The UI and
 * upload are conflated because generally, we want to cancel the upload if the
 * UI element is removed.
 */
import { h } from '../dom';
import { onMount } from '../disposable';

export type Uploader = (opts: {
  file: File;
  onProgress: (progress: number) => void;
}) => { promise: Promise<any>; cancel(): void };

export interface UploadRef {
  id: string;
  file?: File;
  url?: string;
  error?: string;
}

export interface UploaderOpts {
  ref: UploadRef;
  onError(err: string): void;
  upload: Uploader;
}

export function renderUploader(opts: UploaderOpts) {
  const ref = opts.ref;
  const { file } = ref;
  if (!file) {
    return;
  }
  const name = file.name;
  const barEl = h<HTMLElement>('.minidoc-progress-bar');
  const percentEl = h('span.minidoc-upload-percent', '0%');
  const el = h(
    '.minidoc-upload-progress',
    h('header.minidoc-upload-header', h('span.minidoc-upload-name', 'Uploading ', name), percentEl),
    h('.minidoc-progress-bar-wrapper', barEl),
  );

  const onProgress = (percent: number) => {
    percentEl.textContent = `${Math.round(percent)}%`;
    barEl.style.width = `${percent}%`;

    if (percent === 100) {
      barEl.classList.add('minidoc-progress-done');
      // This gives the user a moment to see it's complete, and is just
      // a little UX polish.
      setTimeout(() => el.remove(), 500);
    }
  };

  onMount(el, () => {
    const result = opts.upload({ file, onProgress });
    result.promise
      .then((url) => {
        ref.url = url;
      })
      .catch((err) => {
        opts.onError(`Failed to upload ${name}`);
        el.remove();
        console.error('Upload failed', err);
      })
      .then(() => {
        ref.file = undefined;
      });
    return () => result.cancel();
  });

  onProgress(0);

  return el;
}

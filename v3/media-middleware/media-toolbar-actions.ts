import { h } from '../dom';
import { MinidocToolbarAction, MinidocToolbarEditor } from '../toolbar';
import { Mediable } from './media-card-plugin';

interface MediaToolbarOptions {
  onClick(t: MinidocToolbarEditor): void;
}

const icoPic = `<svg fill="currentColor" viewBox="0 0 24 24"><path d="M5 8.5c0-.828.672-1.5 1.5-1.5s1.5.672 1.5 1.5c0 .829-.672 1.5-1.5 1.5s-1.5-.671-1.5-1.5zm9 .5l-2.519 4-2.481-1.96-4 5.96h14l-5-8zm8-4v14h-20v-14h20zm2-2h-24v18h24v-18z"/></svg>`;

export const mediaToolbarAction = (opts?: MediaToolbarOptions): MinidocToolbarAction => ({
  id: 'media',
  label: 'Add image, video, etc',
  html: icoPic,
  run:
    opts?.onClick ||
    ((t) => {
      const input: any = h('input', {
        type: 'file',
        style: 'visibility: hidden',
        onchange: (e: any) => {
          ((t as unknown) as Mediable).insertMedia(e.target.files[0]);
        },
      });
      document.body.append(input);
      input.click();
      input.remove();
    }),
});

import { MinidocCardDefinition, h } from '../src';

export const videoCard: MinidocCardDefinition<{ src: string; type: string }> = {
  type: 'vid',
  selector: 'video',
  deriveState(el: HTMLVideoElement) {
    const source = el.querySelector('source');
    return { src: source?.src || el.src, type: source?.type || el.dataset.type || 'video/unknown' };
  },
  serialize(opts) {
    return videoCard.render(opts).outerHTML;
  },
  render({ state }) {
    return h('video', { src: state.src, 'data-type': state.type, controls: true });
  },
};

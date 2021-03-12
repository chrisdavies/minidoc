import { MinidocCardDefinition, h } from '../src';

export const imgCard: MinidocCardDefinition<{ src: string; caption?: string }> = {
  type: 'img',
  selector: 'img,figure',
  deriveState(el) {
    switch (el.tagName) {
      case 'IMG': {
        const img = el as HTMLImageElement;
        return { src: img.src, caption: img.alt };
      }
      default: {
        const img = el.querySelector('img');
        const caption = el.querySelector('caption');
        return {
          src: img?.src || '',
          caption: caption?.textContent || img?.alt || '',
        };
      }
    }
  },
  serialize(opts) {
    return imgCard.render(opts).outerHTML;
  },
  render({ state }) {
    return h(
      'figure',
      h('img', { src: state.src, alt: state.caption }),
      state.caption && h('figcaption', state.caption),
    );
  },
};

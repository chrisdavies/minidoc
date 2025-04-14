import { MinidocCardDefinition, h } from '../src';

export const imgCard: MinidocCardDefinition<{ src: string; caption?: string }> = {
  type: 'img',
  selector: 'img,figure',
  deriveState(el) {
    const stateJSONStr = el.dataset.state;
    if (stateJSONStr) {
      return JSON.parse(stateJSONStr);
    }
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
    const img = h<HTMLImageElement>('img', { src: state.src, alt: state.caption });
    const fig = h('figure', img, state.caption && h('figcaption', state.caption));
    return fig;
  },
};

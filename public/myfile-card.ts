import { h, MinidocCardDefinition } from '../src';

interface State {
  name: string;
  type: string;
  src: string;
}

const renderReadOnly = (state: State) =>
  h('a.demo-file', { href: state.src, download: state.name, 'data-type': state.type }, state.name);

export const myfileCard: MinidocCardDefinition<State> = {
  type: 'myfile',
  selector: 'a[download]',
  deriveState(el: HTMLAnchorElement) {
    return {
      src: el.href,
      name: el.download,
      type: el.dataset.type,
    };
  },
  serialize({ state }) {
    return renderReadOnly(state).outerHTML;
  },
  render(opts) {
    if (opts.readonly) {
      return renderReadOnly(opts.state);
    }
    return h('div.demo-file', opts.state.name);
  },
};

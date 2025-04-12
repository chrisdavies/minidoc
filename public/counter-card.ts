import { Cardable, h, MinidocCardDefinition, MinidocToolbarAction, on, onMount } from '../src';
import { LinkBehavior } from '../src/link/link-menu';

type State = { count: number; href?: string };
const counterButtonText = ({ count }: State) => `Count=${count}`;
const counterButton = (state: State) =>
  h('button', { 'data-count': state.count }, counterButtonText(state));

export const counterCard: MinidocCardDefinition<State> = {
  type: 'counter',
  selector: 'button[data-count]',
  deriveState(el) {
    return { count: parseInt(el.dataset.count || '0', 10) };
  },
  serialize({ state }) {
    return counterButton(state).outerHTML;
  },
  render(opts) {
    const { state } = opts;
    const btn = counterButton(state);
    const root = h('div', btn, state.href ? h('a', { href: state.href }, 'LINK') : '');

    const behavior: LinkBehavior = {
      getHref() {
        return root.querySelector('a')?.href || '';
      },
      setHref(href: string) {
        if (!href) {
          root.querySelector('a')?.remove();
          return;
        }
        const a = root.querySelector('a') || h<HTMLAnchorElement>('a');
        a.href = href;
        a.textContent = href;
        root.append(a);
      },
    };

    opts.behavior = behavior;

    on(btn, 'click', () => {
      ++state.count;
      btn.dataset.count = state.count.toString();
      btn.textContent = counterButtonText(state);
    });

    onMount(root, () => {
      console.log(`counter:init(${state.count})`);
      return () => console.log(`counter:dispose(${state.count})`);
    });
    return root;
  },
};

export const toolbarCounter: MinidocToolbarAction = {
  id: 'counter',
  label: 'Counter',
  html: '+/-',
  run: (t) => (t as unknown as Cardable).insertCard<State>('counter', { count: 42 }),
};

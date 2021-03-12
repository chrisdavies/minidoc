import { Cardable, h, MinidocCardDefinition, MinidocToolbarAction, on, onMount } from '../src';

type State = { count: number };
const counterButtonText = ({ count }: State) => `Count=${count}`;
const counterButton = (state: State) =>
  h('button', { 'data-count': state.count }, counterButtonText(state));

export const counterCard: MinidocCardDefinition<{ count: number }> = {
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
    const el = counterButton(state);
    on(el, 'click', () => {
      ++state.count;
      el.dataset.count = state.count.toString();
      el.textContent = counterButtonText(state);
    });
    onMount(el, () => {
      console.log(`counter:init(${state.count})`);
      return () => console.log(`counter:dispose(${state.count})`);
    });
    return el;
  },
};

export const toolbarCounter: MinidocToolbarAction = {
  id: 'counter',
  label: 'Counter',
  html: '+/-',
  run: (t) => ((t as unknown) as Cardable).insertCard<State>('counter', { count: 42 }),
};

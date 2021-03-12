import * as integrationTests from '../index';
import { h, on } from '../dom';
import { CardRenderOptions } from '../card';

type State = { count: number };

const text = (count: number, isReadonly: boolean) =>
  `Count is ${count}${isReadonly ? ' (readonly)' : ''}`;

const renderReadOnly = (opts: CardRenderOptions<State>) =>
  h('button', { 'data-count': opts.state.count }, text(opts.state.count, opts.readonly));

const counterCard: integrationTests.MinidocCardDefinition<State> = {
  type: 'counter',
  selector: 'button[data-count]',
  deriveState(el) {
    return { count: parseInt(el.dataset.count || '0', 10) };
  },
  serialize(opts) {
    return renderReadOnly(opts).outerHTML;
  },
  render(opts) {
    const el = renderReadOnly(opts);
    on(el, 'click', (e: any) => (e.target.textContent = text(++opts.state.count, opts.readonly)));
    return el;
  },
};

(window as any).integrationTests = {
  ...integrationTests,
  counterCard,
};

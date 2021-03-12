import * as integrationTests from '../index';
import { h, on } from '../dom';

const text = (count: number, isReadonly: boolean) =>
  `Count is ${count}${isReadonly ? ' (readonly)' : ''}`;

const counterCard: integrationTests.MinidocCardDefinition<{ count: number }> = {
  type: 'counter',
  selector: 'button[data-count]',
  deriveState(el) {
    return { count: parseInt(el.dataset.count || '0', 10) };
  },
  serialize(opts) {
    return h('button', { 'data-count': opts.state.count }, text(opts.state.count, opts.readonly));
  },
  render(opts) {
    const el = counterCard.serialize(opts);
    on(el, 'click', (e: any) => (e.target.textContent = text(++opts.state.count, opts.readonly)));
    return el;
  },
};

(window as any).integrationTests = {
  ...integrationTests,
  counterCard,
};

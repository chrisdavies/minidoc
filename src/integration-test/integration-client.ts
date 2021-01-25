import * as integrationTests from '../index';
import { onMount } from '../disposable';
import { h } from '../dom';

const counterCard: integrationTests.MinidocCardDefinition = {
  type: 'counter',
  render(opts) {
    let count = opts.state || 0;

    const el = h(
      'button',
      { onclick: (e: any) => (e.target.textContent = `Incremented count + ${++count}`) },
      `Empty count ${count} is readonly: ${opts.editor.readonly}`,
    );
    onMount(el, () => {
      console.log(`counter:init(${count})`);
      return () => console.log(`counter:dispose(${count})`);
    });
    return el;
  },
};

(window as any).integrationTests = {
  ...integrationTests,
  counterCard,
};

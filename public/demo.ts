import { onMount } from '../src/disposable';
import { minidoc, cardPlugin, defaultPlugins } from '../src';
import { h } from '../src/dom';
import '../src/types';

const counterCard: MinidocCardDefinition = {
  type: 'counter',
  render(opts) {
    let count = opts.state || 0;

    const el = h(
      'button',
      { onclick: (e) => (e.target.textContent = `Incremented count + ${++count}`) },
      `Empty count ${count}`,
    );
    onMount(el, () => {
      console.log(`counter:init(${count})`);
      return () => console.log(`counter:dispose(${count})`);
    });
    return el;
  },
};

const el = document.querySelector('.example-doc');

el.remove();

const editor = minidoc({
  doc: el.innerHTML,
  plugins: [cardPlugin([counterCard]), ...defaultPlugins],
});

document.querySelector('main').appendChild(editor.container);

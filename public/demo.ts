import { onMount } from '../src/disposable';
import { minidoc, cardPlugin, defaultPlugins, defaultToolbarActions } from '../src';
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

const toolbarCounter: MinidocToolbarAction = {
  id: 'counter',
  label: 'Counter',
  html: '+/-',
  run: (t) => (t as Cardable<typeof t>).cards.insert('counter', 42),
};

const el = document.querySelector('.example-doc');

el.remove();

const editor = minidoc({
  doc: el.innerHTML,
  plugins: [cardPlugin([counterCard]), ...defaultPlugins],
  toolbarActions: [...defaultToolbarActions, toolbarCounter],
});

document.querySelector('main').appendChild(editor.container);

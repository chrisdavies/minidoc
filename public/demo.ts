import { onMount } from '../src/disposable';
import { minidoc, createToolbar, cardPlugin, defaultPlugins, defaultToolbarActions } from '../src';
import * as Dom from '../src/dom';
import { h } from '../src/dom';
import { debounce } from '../src/util';
import '../src/types';

function Sticky(child: Node) {
  const placeholder = h('div', { style: 'height: 0px' }) as HTMLDivElement;
  const el = h('div', placeholder, child);
  let isStuck = false;

  Dom.on(
    el.closest('.minidoc-scroll-container') || window,
    'scroll',
    debounce(() => {
      const bounds = el.getBoundingClientRect();
      const shouldBeStuck = bounds.y < 0;
      if (shouldBeStuck !== isStuck) {
        isStuck = shouldBeStuck;
        el.classList.toggle('minidoc-toolbar-stuck', isStuck);
        Dom.assignAttrs({ style: `height: ${isStuck ? bounds.height : 0}px` }, placeholder);
      }
    }),
  );

  return el;
}

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

const mediaCard: MinidocCardDefinition = {
  type: 'media',
  render(opts) {
    const { src, alt, type } = opts.state || { type: 'img', src: '/img/monkey.jpg', alt: 'monkey' };

    if (type === 'img') {
      return h('img', { src, alt });
    } else {
      return h('video', { src, controls: true, preload: 'metadata' });
    }
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
  plugins: [cardPlugin([counterCard, mediaCard]), ...defaultPlugins],
});

const toolbar = createToolbar({
  editor,
  actions: [...defaultToolbarActions, toolbarCounter],
});

Dom.appendChildren([Sticky(toolbar.root), editor.root], document.querySelector('main'));

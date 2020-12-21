import { onMount } from '../src/disposable';
import {
  minidoc,
  createToolbar,
  cardPlugin,
  defaultPlugins,
  defaultToolbarActions,
  mediaCardPlugin,
  mediaToolbarAction,
} from '../src';
import * as Dom from '../src/dom';
import { h } from '../src/dom';
import { debounce } from '../src/util';
import '../src/types';
import { MinidocCardDefinition, MinidocToolbarAction, Cardable } from '../src/types';
import { mockUpload } from './mock-upload';

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
  placeholder: 'Type something awesome here.',
  plugins: [
    cardPlugin([counterCard]),
    mediaCardPlugin({
      upload: mockUpload,
      renderMedia(state) {
        if (state.type.startsWith('image/')) {
          return h('img', { src: state.url, alt: state.name });
        } else if (state.type.startsWith('video/')) {
          return h('video', { src: state.url, controls: true });
        } else if (state.type.startsWith('audio/')) {
          return h('audio', { src: state.url });
        } else {
          return h('a.minidoc-unknown-media', { href: state.url }, state.name);
        }
      },
    }),
    ...defaultPlugins,
  ],
});

const toolbar = createToolbar({
  editor,
  actions: [...defaultToolbarActions, toolbarCounter, mediaToolbarAction()],
});

Dom.appendChildren([Sticky(toolbar.root), editor.root], document.querySelector('main'));

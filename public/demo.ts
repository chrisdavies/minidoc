import {
  minidoc,
  minidocToolbar,
  defaultToolbarActions,
  placeholder,
  cardMiddleware,
  MinidocCardDefinition,
  onMount,
  MinidocToolbarAction,
  Cardable,
  fileDrop,
} from '../src';
import * as Dom from '../src/dom';
import { h, on } from '../src/dom';
import { debounce } from '../src/util';

let readonly = location.search === '?readonly';

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

const counterButtonText = ({ count }: { count: number }) => `Count=${count}`;
const counterCard: MinidocCardDefinition<{ count: number }> = {
  type: 'counter',
  selector: 'button[data-count]',
  deriveState(el) {
    return { count: parseInt(el.dataset.count || '0', 10) };
  },
  serialize({ state }) {
    return h('button', { 'data-count': state.count }, counterButtonText(state));
  },
  render(opts) {
    const { state } = opts;
    const el = counterCard.serialize(opts);
    on(el, 'click', (e) => {
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

const myfileCard: MinidocCardDefinition = {
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
    return h(
      'a.demo-file',
      { href: state.src, download: state.name, 'data-type': state.type },
      state.name,
    );
  },
  render(opts) {
    if (opts.readonly) {
      return myfileCard.serialize(opts);
    }
    return h('div.demo-file', opts.state.name);
  },
};

const videoCard: MinidocCardDefinition<{ src: string; type: string }> = {
  type: 'vid',
  selector: 'video',
  deriveState(el: HTMLVideoElement) {
    const source = el.querySelector('source');
    return { src: source?.src || el.src, type: source?.type || el.dataset.type || 'video/unknown' };
  },
  serialize({ state }) {
    return h('video', { src: state.src, 'data-type': state.type, controls: true });
  },
  render(opts) {
    return videoCard.serialize(opts);
  },
};

const imgCard: MinidocCardDefinition<{ src: string; caption?: string }> = {
  type: 'img',
  selector: 'img,figure',
  deriveState(el) {
    switch (el.tagName) {
      case 'IMG': {
        const img = el as HTMLImageElement;
        return { src: img.src, caption: img.alt };
      }
      default: {
        const img = el.querySelector('img');
        const caption = el.querySelector('caption');
        return {
          src: img?.src || '',
          caption: caption?.textContent || img?.alt || '',
        };
      }
    }
  },
  serialize({ state }) {
    return h(
      'figure',
      h('img', { src: state.src, alt: state.caption }),
      state.caption && h('figcaption', state.caption),
    );
  },
  render(opts) {
    return imgCard.serialize(opts);
  },
};

const toolbarCounter: MinidocToolbarAction = {
  id: 'counter',
  label: 'Counter',
  html: '+/-',
  run: (t) => ((t as unknown) as Cardable).insertCard('counter', { count: 42 }),
};

const el = document.querySelector('.example-doc');

el.remove();

const editor = minidoc({
  readonly,
  doc: el.innerHTML,
  middleware: [
    placeholder('Type something fanci here.'),
    minidocToolbar([...defaultToolbarActions, toolbarCounter]),
    cardMiddleware([counterCard, myfileCard, imgCard, videoCard]),
    // The fileDrop middleware adds support for dropping files onto the editor via
    // the HTML5 drag / drop API.
    fileDrop((opts) => {
      editor.insertCard('myfile', { type: opts.files[0].type, name: opts.files[0].name });
    }),
  ],
});

Dom.appendChildren(
  [!readonly && Sticky(editor.toolbar.root), editor.root],
  document.querySelector('main'),
);

document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 's') {
    e.preventDefault();
    e.stopPropagation();
    console.log(editor.serialize());
  }
});

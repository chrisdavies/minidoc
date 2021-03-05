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
import { h } from '../src/dom';
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

const counterCard: MinidocCardDefinition = {
  type: 'counter',
  render(opts) {
    let count = opts.state || 0;

    const el = h(
      'button',
      {
        onclick: (e) => {
          ++count;
          // This is how we notify minidoc that we have a new
          // state (so it shows up in undo / redo history)
          opts.stateChanged(count);
          e.target.textContent = `Incremented count + ${count}`;
        },
      },
      `Empty count ${count}`,
    );
    onMount(el, () => {
      console.log(`counter:init(${count})`);
      return () => console.log(`counter:dispose(${count})`);
    });
    return el;
  },
};

const myfileCard: MinidocCardDefinition = {
  type: 'myfile',
  render(opts) {
    return h('.demo-file', `${opts.state.type}: ${opts.state.name}`);
  },
};

const toolbarCounter: MinidocToolbarAction = {
  id: 'counter',
  label: 'Counter',
  html: '+/-',
  run: (t) => ((t as unknown) as Cardable).insertCard('counter', 42),
};

const el = document.querySelector('.example-doc');

el.remove();

const editor = minidoc({
  readonly,
  doc: el.innerHTML,
  middleware: [
    placeholder('Type something fanci here.'),
    minidocToolbar([...defaultToolbarActions, toolbarCounter]),
    cardMiddleware([counterCard, myfileCard]),
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

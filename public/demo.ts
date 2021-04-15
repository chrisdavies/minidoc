import {
  minidoc,
  minidocToolbar,
  defaultToolbarActions,
  placeholder,
  cardMiddleware,
  fileDrop,
} from '../src';
import * as Dom from '../src/dom';
import { h } from '../src/dom';
import { counterCard, toolbarCounter } from './counter-card';
import { debounce } from '../src/util';
import { myfileCard } from './myfile-card';
import { videoCard } from './video-card';
import { imgCard } from './img-card';

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

const titleEl = document.querySelector('.title-doc');
titleEl.remove();

const titleEditor = minidoc({
  readonly,
  doc: titleEl.innerHTML,
  middleware: [placeholder('Title here')],
  singleLine: true,
});
titleEditor.root.classList.add('title-editor');

Dom.appendChildren(
  [!readonly && Sticky(editor.toolbar.root), titleEditor.root, editor.root],
  document.querySelector('main'),
);

document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 's') {
    e.preventDefault();
    e.stopPropagation();
    console.log(editor.serialize());
  }
});

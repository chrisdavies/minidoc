import * as Rng from '../range';
import { onMount } from '../disposable';
import { h } from '../dom';
import { debounce } from '../util';
import { Sticky } from './sticky';

const icoLink = `
  <svg height="0.9rem" fill="currentColor" viewBox="0 0 24 24">
    <path d="M13.723 18.654l-3.61 3.609c-2.316 2.315-6.063 2.315-8.378 0-1.12-1.118-1.735-2.606-1.735-4.188 0-1.582.615-3.07 1.734-4.189l4.866-4.865c2.355-2.355 6.114-2.262 8.377 0 .453.453.81.973 1.089 1.527l-1.593 1.592c-.18-.613-.5-1.189-.964-1.652-1.448-1.448-3.93-1.51-5.439-.001l-.001.002-4.867 4.865c-1.5 1.499-1.5 3.941 0 5.44 1.517 1.517 3.958 1.488 5.442 0l2.425-2.424c.993.284 1.791.335 2.654.284zm.161-16.918l-3.574 3.576c.847-.05 1.655 0 2.653.283l2.393-2.389c1.498-1.502 3.94-1.5 5.44-.001 1.517 1.518 1.486 3.959 0 5.442l-4.831 4.831-.003.002c-1.438 1.437-3.886 1.552-5.439-.002-.473-.474-.785-1.042-.956-1.643l-.084.068-1.517 1.515c.28.556.635 1.075 1.088 1.528 2.245 2.245 6.004 2.374 8.378 0l4.832-4.831c2.314-2.316 2.316-6.062-.001-8.377-2.317-2.321-6.067-2.313-8.379-.002z" />
  </svg>
`;

const icoPic = `<svg height="1rem" fill="currentColor" viewBox="0 0 24 24"><path d="M5 8.5c0-.828.672-1.5 1.5-1.5s1.5.672 1.5 1.5c0 .829-.672 1.5-1.5 1.5s-1.5-.671-1.5-1.5zm9 .5l-2.519 4-2.481-1.96-4 5.96h14l-5-8zm8-4v14h-20v-14h20zm2-2h-24v18h24v-18z"/></svg>`;

const icoOl = `<svg fill="currentColor" viewBox="0 0 16 16" width="16" height="16"><path fill-rule="evenodd" d="M2.003 2.5a.5.5 0 00-.723-.447l-1.003.5a.5.5 0 00.446.895l.28-.14V6H.5a.5.5 0 000 1h2.006a.5.5 0 100-1h-.503V2.5zM5 3.25a.75.75 0 01.75-.75h8.5a.75.75 0 010 1.5h-8.5A.75.75 0 015 3.25zm0 5a.75.75 0 01.75-.75h8.5a.75.75 0 010 1.5h-8.5A.75.75 0 015 8.25zm0 5a.75.75 0 01.75-.75h8.5a.75.75 0 010 1.5h-8.5a.75.75 0 01-.75-.75zM.924 10.32l.003-.004a.851.851 0 01.144-.153A.66.66 0 011.5 10c.195 0 .306.068.374.146a.57.57 0 01.128.376c0 .453-.269.682-.8 1.078l-.035.025C.692 11.98 0 12.495 0 13.5a.5.5 0 00.5.5h2.003a.5.5 0 000-1H1.146c.132-.197.351-.372.654-.597l.047-.035c.47-.35 1.156-.858 1.156-1.845 0-.365-.118-.744-.377-1.038-.268-.303-.658-.484-1.126-.484-.48 0-.84.202-1.068.392a1.858 1.858 0 00-.348.384l-.007.011-.002.004-.001.002-.001.001a.5.5 0 00.851.525zM.5 10.055l-.427-.26.427.26z"></path></svg>`;

const icoUl = `<svg fill="currentColor" viewBox="0 0 16 16" width="16" height="16"><path fill-rule="evenodd" d="M2 4a1 1 0 100-2 1 1 0 000 2zm3.75-1.5a.75.75 0 000 1.5h8.5a.75.75 0 000-1.5h-8.5zm0 5a.75.75 0 000 1.5h8.5a.75.75 0 000-1.5h-8.5zm0 5a.75.75 0 000 1.5h8.5a.75.75 0 000-1.5h-8.5zM3 8a1 1 0 11-2 0 1 1 0 012 0zm-1 6a1 1 0 100-2 1 1 0 000 2z"></path></svg>`;

interface MinidocToolbarAction {
  id: string;
  label?: string;
  html: string;
  run(editor: MinidocEditor): any;
  isActive?(editor: MinidocEditor): boolean;
}

const actions: MinidocToolbarAction[] = [
  {
    id: 'h1',
    label: 'Heading 1',
    html: '<b>h1</b>',
    run: (t) => t.toggleBlock('h1'),
    isActive: (t) => t.isWithin('h1'),
  },
  {
    id: 'h2',
    label: 'Heading 2',
    html: '<b>h2</b>',
    run: (t) => t.toggleBlock('h2'),
    isActive: (t) => t.isWithin('h2'),
  },
  {
    id: 'bold',
    label: 'Bold',
    html: '<b>b</b>',
    run: (t) => t.toggleInline('strong'),
    isActive: (t) => t.isWithin('strong') || t.isWithin('b') || document.queryCommandState('bold'),
  },
  {
    id: 'italic',
    label: 'Italic',
    html: '<i>i</i>',
    run: (t) => t.toggleInline('em'),
    isActive: (t) => t.isWithin('em') || t.isWithin('i') || document.queryCommandState('italic'),
  },
  {
    id: 'link',
    label: 'Link',
    html: icoLink,
    run: () => {
      console.log('TODO: link');
    },
    isActive: (t) => t.isWithin('a'),
  },
  {
    id: 'addFile',
    label: 'Add file',
    html: icoPic,
    run: () => {
      console.log('TODO: pick file');
    },
  },
  {
    id: 'ol',
    label: 'Ordered list',
    html: icoOl,
    run: (t) => t.toggleList('ol'),
    isActive: (t) => t.isWithin('ol'),
  },
  {
    id: 'ul',
    label: 'Bullet list',
    html: icoUl,
    run: (t) => t.toggleList('ul'),
    isActive: (t) => t.isWithin('ul'),
  },
];

function ToolbarButton(
  editor: MinidocEditor,
  { label, isActive, html, run }: MinidocToolbarAction,
) {
  const btn = h('button.minidoc-toolbar-btn', {
    refreshState:
      isActive && (() => btn.classList.toggle('minidoc-toolbar-btn-active', isActive(editor))),
    onclick: () => run(editor),
    'aria-label': label,
    innerHTML: html,
  });
  return btn;
}

export function createToolbar(editor: MinidocEditor) {
  const btns = actions.map((b) => ToolbarButton(editor, b));
  const refreshButtons = debounce(() => {
    const node = Rng.currentNode();
    node && editor.root.contains(node) && btns.forEach((b: any) => b.refreshState?.());
  });
  const container = h('header.minidoc-toolbar', h('.minidoc-default-menu', btns));
  const root = Sticky(container);

  onMount(root, () => editor.on('caretchange', refreshButtons));

  return {
    root,
  };
}

import { linkToolbarAction } from './link/link-toolbar-action';
import { orderedListToolbarAction, unorderedListToolbarAction } from './list';
import { MinidocToolbarAction } from './toolbar';
import { colorToolbarAction, highlightToolbarAction } from './highlight';

export * from './toolbar';
export * from './card';
export * from './file-drop';
export * from './placeholder';
export * from './minidoc';
export * from './mixins';
export * from './undo-redo';
export * as scrubbable from './scrubbable';
export { LinkBehavior } from './link/link-menu';
export { h, on } from './dom';
export { onMount } from './disposable';

import './css/index.css';
import { alignToolbarAction } from './align';

export const defaultToolbarActions: MinidocToolbarAction[] = [
  {
    id: 'h1',
    label: 'Heading 1',
    html: '<b>h1</b>',
    run: (t) => t.toggleBlock('h1'),
    isActive: (t) => t.isActive('h1'),
  },
  {
    id: 'h2',
    label: 'Heading 2',
    html: '<b>h2</b>',
    run: (t) => t.toggleBlock('h2'),
    isActive: (t) => t.isActive('h2'),
  },
  {
    id: 'h3',
    label: 'Heading 3',
    html: '<b>h3</b>',
    run: (t) => t.toggleBlock('h3'),
    isActive: (t) => t.isActive('h3'),
  },
  {
    id: 'blockquote',
    label: 'Quote',
    html: '<b class="minidoc-quote">”</b>',
    run: (t) => t.toggleBlock('blockquote'),
    isActive: (t) => t.isActive('blockquote'),
  },
  {
    id: 'bold',
    label: 'Bold',
    html: '<b>b</b>',
    run: (t) => t.toggleInline('STRONG'),
    isActive: (t) => t.isActive('STRONG'),
  },
  {
    id: 'underline',
    label: 'Underline',
    html: '<u>u</u>',
    run: (t) => t.toggleInline('U'),
    isActive: (t) => t.isActive('U'),
  },
  {
    id: 'italic',
    label: 'Italic',
    html: '<i>i</i>',
    run: (t) => t.toggleInline('EM'),
    isActive: (t) => t.isActive('EM'),
  },
  alignToolbarAction,
  linkToolbarAction,
  orderedListToolbarAction,
  unorderedListToolbarAction,
  highlightToolbarAction,
  colorToolbarAction,
];

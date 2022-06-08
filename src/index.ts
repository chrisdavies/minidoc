import { linkToolbarAction } from './link/link-toolbar-action';
import { orderedListToolbarAction, unorderedListToolbarAction } from './list';
import { MinidocToolbarAction } from './toolbar';
import { highlightToolbarAction } from './highlight';

export * from './toolbar';
export * from './card';
export * from './file-drop';
export * from './placeholder';
export * from './minidoc';
export * from './mixins';
export * as scrubbable from './scrubbable';
export { h, on } from './dom';
export { onMount } from './disposable';

import './css/index.css';

// I don't like that this is global, but... it's the best way to get
// paragraphs when the user presses enter.
document.execCommand('defaultParagraphSeparator', false, 'p');

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
    id: 'italic',
    label: 'Italic',
    html: '<i>i</i>',
    run: (t) => t.toggleInline('EM'),
    isActive: (t) => t.isActive('EM'),
  },
  linkToolbarAction,
  orderedListToolbarAction,
  unorderedListToolbarAction,
  highlightToolbarAction,
];

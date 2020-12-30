import { linkToolbarAction } from './link/link-toolbar-action';
import { MinidocToolbarAction } from './toolbar';

export * from './toolbar';
export * from './card';
export * from './media-middleware';
export * from './placeholder';
export * from './minidoc';
export { onMount } from './disposable';

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
  // TODO: move these to the new middleware system
  // linkToolbarAction,
  // orderedListToolbarAction,
  // unorderedListToolbarAction,
];

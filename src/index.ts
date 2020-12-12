import { createCoreEditor } from './core';
import { listPlugin, orderedListToolbarAction, unorderedListToolbarAction } from './list';
import { linkToolbarAction } from './link';
import { defaultPlugin } from './default-plugin';
import { clipboardPlugin } from './clipboard';
import * as Disposable from './disposable';
import { compose } from './util';

export * from './toolbar';
export * from './card';

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
  orderedListToolbarAction,
  unorderedListToolbarAction,
];

export const defaultPlugins: MinidocPlugin[] = [listPlugin, defaultPlugin, clipboardPlugin];

export function minidoc(opts: MinidocOptions): MinidocEditor {
  const editor = createCoreEditor({ ...opts, plugins: opts.plugins || defaultPlugins });
  editor.dispose = compose(editor.dispose, Disposable.initialize(editor.root).dispose);
  return editor;
}

import { h } from '../dom';
import { disposable } from './disposable-mixin';
import { EditorMiddleware, MinidocBase, ReturnTypesIntersection, MinidocOptions } from '../types';
import { serializable } from '../serializable';
import { mountable } from '../mountable';
import { undoRedoMiddleware } from '../undo-redo';
import { inlineTogglable } from '../inline-toggle';
import { dragDropMixin } from '../drag-drop';
import { selectionTracker } from '../selection-tracker';
import { blockTogglable } from '../block-toggle';
import { listMixin } from '../list';
import { clipbordMiddleware } from '../clipboard-middleware';
import { stylePrevention } from '../style-prevention';
import { onSequenceMixin } from '../on-sequence';
import { horizontalRuleMixin } from '../horizontal-rule';
import { scrubbableMiddleware } from '../scrubbable';

function getDefaultMiddleware<T extends Array<EditorMiddleware>>(middleware: T): T {
  return middleware;
}

const defaultMiddleware = getDefaultMiddleware([
  scrubbableMiddleware(),
  stylePrevention,
  onSequenceMixin,
  disposable,
  serializable,
  mountable,
  undoRedoMiddleware,
  inlineTogglable,
  dragDropMixin,
  selectionTracker,
  blockTogglable,
  listMixin,
  horizontalRuleMixin,
  clipbordMiddleware,
]);

function applyMiddleware(middleware: any[], editor: any, i: number) {
  if (i >= middleware.length) {
    return editor;
  }
  const result = middleware[i](
    (nextEditor: any) => applyMiddleware(middleware, nextEditor, i + 1),
    editor,
  );
  if (!result) {
    console.error(
      `Middleware ${i} returned an undefined editor.`,
      middleware[i],
      middleware,
      editor,
    );
    throw new Error(`Middleware ${i} returned an undefined editor.`);
  }
  return result;
}

export type MinidocCore = MinidocBase & ReturnTypesIntersection<typeof defaultMiddleware>;

export function minidoc<T extends Array<EditorMiddleware>>(
  opts: MinidocOptions<T>,
): MinidocCore & ReturnTypesIntersection<T> {
  const root =
    opts.root ||
    h(
      `div.minidoc-editor.minidoc-content${
        opts.readonly ? '.minidoc-readonly' : '.minidoc-editable'
      }`,
      {
        contentEditable: !opts.readonly,
      },
    );
  root.innerHTML = opts.doc;
  // If the root already has an editor associated with it, dispose it.
  (root as any).$editor?.dispose();
  const core: MinidocBase = { root, readonly: opts.readonly };
  const middleware = opts.middleware
    ? [...defaultMiddleware, ...opts.middleware]
    : defaultMiddleware;
  const editor = applyMiddleware(middleware, core, 0) as MinidocCore & ReturnTypesIntersection<T>;

  // Associate the editor with the root element.
  (root as any).$editor = editor;
  editor.beforeMount(editor.scrub(core.root));
  return editor;
}

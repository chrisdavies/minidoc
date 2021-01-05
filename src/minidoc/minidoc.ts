import { h } from '../dom';
import { disposable } from './disposable-mixin';
import { EditorMiddleware, MinidocBase, ReturnTypesIntersection, MinidocOptions } from '../types';
import { serializable } from '../serializable';
import { mountable } from '../mountable';
import { undoRedoMiddleware } from '../undo-redo';
import { inlineTogglable } from '../inilne-toggle';
import { dragDropMixin } from '../drag-drop';
import { selectionTracker } from '../selection-tracker';
import { blockTogglable } from '../block-toggle';
import { listMixin } from '../list';
import { clipbordMiddleware } from '../clipboard-middleware';

function getDefaultMiddleware<T extends Array<EditorMiddleware>>(middleware: T): T {
  return middleware;
}

const defaultMiddleware = getDefaultMiddleware([
  disposable,
  serializable,
  mountable,
  undoRedoMiddleware,
  inlineTogglable,
  dragDropMixin,
  selectionTracker,
  blockTogglable,
  listMixin,
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
  const core: MinidocBase = {
    root: h('div.minidoc-editor', {
      contentEditable: true,
      innerHTML: opts.doc,
    }),
  };

  const middleware = opts.middleware
    ? [...defaultMiddleware, ...opts.middleware]
    : defaultMiddleware;
  const editor = applyMiddleware(middleware, core, 0) as MinidocCore & ReturnTypesIntersection<T>;
  editor.beforeMount(core.root);
  return editor;
}

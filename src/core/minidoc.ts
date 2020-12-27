import { h } from '../dom';
import { disposable } from './disposable';
import {
  EditorMiddleware,
  MinidocBase,
  ReturnTypesIntersection,
  MinidocOptions,
} from '../minidoc-types';
import { serializable } from './serializable';
import { mountable } from './mountable';
import { undoredoable } from './undoredo';
import { inlineTogglable } from './inline-togglable';
import { dragDroppable } from './dragdroppable';
import { selectionTracker } from './selection-tracker';
import { blockTogglable } from './block-togglable';
import { listTogglable } from './list-togglable';
import { clipbordMiddleware } from '../clipboard-middleware';

function getDefaultMiddleware<T extends Array<EditorMiddleware>>(middleware: T): T {
  return middleware;
}

const defaultMiddleware = getDefaultMiddleware([
  disposable,
  serializable,
  mountable,
  undoredoable,
  inlineTogglable,
  dragDroppable,
  selectionTracker,
  blockTogglable,
  listTogglable,
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
  const editor: MinidocBase = {
    root: h('div.minidoc-editor', {
      contentEditable: true,
      innerHTML: opts.doc,
    }),
  };

  const middleware = opts.middleware
    ? [...opts.middleware, ...defaultMiddleware]
    : defaultMiddleware;
  return applyMiddleware(middleware, editor, 0);
}

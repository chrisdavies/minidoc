import { h } from '../dom';
import { coreMixin } from './core-mixin';
import { MinidocBase, ReturnTypesIntersection, MinidocOptions, EditorMiddleware } from '../types';
import { mountable } from '../mountable';
import { inlineTogglable } from '../inline-toggle';
import { alignMixin } from '../align';
import { dragDropMixin } from '../drag-drop';
import { selectionTracker } from '../selection-tracker';
import { blockTogglable } from '../block-toggle';
import { listMixin } from '../list';
import { clipbordMiddleware } from '../clipboard-middleware';
import { stylePrevention } from '../style-prevention';
import { onSequenceMixin } from '../on-sequence';
import { horizontalRuleMixin } from '../horizontal-rule';
import { middleware as scrubbableMiddleware } from '../scrubbable';
import { undoRedoMiddleware } from '../undo-redo';

function getDefaultMiddleware<T extends Array<EditorMiddleware>>(middleware: T): T {
  return middleware;
}

const readOnlyMiddleware = getDefaultMiddleware([scrubbableMiddleware(), coreMixin, mountable]);

const baseMiddleware = getDefaultMiddleware([
  scrubbableMiddleware(),
  stylePrevention,
  onSequenceMixin,
  coreMixin,
  mountable,
  undoRedoMiddleware(),
  inlineTogglable,
  dragDropMixin,
  selectionTracker,
  blockTogglable,
  listMixin,
  alignMixin,
  horizontalRuleMixin,
  clipbordMiddleware,
]);

function applyMiddleware(middleware: any[], editor: any, opts: MinidocOptions<any>, i: number) {
  if (i >= middleware.length) {
    // We're at the end of our mixin run. We set the initial state here since all of the plugins
    // should have done their initial attachment, but they can save their analysis of the
    // content until the unwinding phase of mixin initialization.
    editor.setState(
      {
        doc: opts.doc,
        selection: { start: [] },
      },
      { focus: false },
    );

    return editor;
  }
  const result = middleware[i](
    (nextEditor: any) => applyMiddleware(middleware, nextEditor, opts, i + 1),
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

export type MinidocCore = MinidocBase & ReturnTypesIntersection<typeof baseMiddleware>;
export type ReadonlyMinidocCore = MinidocBase & ReturnTypesIntersection<typeof readOnlyMiddleware>;

type ReturnedMinidocCore = MinidocCore | ReadonlyMinidocCore;

/**
 * We need to set the defaultParagraphSeparator whenever minidoc is initialized
 * in edit mode. This causes the browser to insert a 'p' rather than a 'div' or
 * some other such thing when the user presses Enter. This only needs to be
 * done once, so we change this to a noop when it's run.
 */
let globalInit = () => {
  globalInit = () => {};
};

export function minidoc<T extends Array<EditorMiddleware>>(opts: MinidocOptions<T>) {
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

  if (!opts.readonly) {
    globalInit();
  }

  // If the root already has an editor associated with it, dispose it.
  (root as any).$editor?.dispose();
  const core: MinidocBase = {
    root,
    readonly: opts.readonly,
  };
  const defaultMiddleware = opts.readonly ? readOnlyMiddleware : baseMiddleware;
  const middleware = opts.middleware
    ? [...defaultMiddleware, ...opts.middleware]
    : defaultMiddleware;
  const editor = applyMiddleware(middleware, core, opts, 0) as ReturnedMinidocCore &
    ReturnTypesIntersection<typeof middleware>;

  // Associate the editor with the root element.
  (root as any).$editor = editor;

  return editor;
}

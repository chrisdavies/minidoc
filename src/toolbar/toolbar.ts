/**
 * This minidoc plugin adds a toolbar to the editor.
 */

import { EditorMiddlewareMixin } from '../types';
import * as Rng from '../range';
import { ToolbarButton } from './toolbar-button';
import * as Dom from '../dom';
import { h } from '../dom';
import * as Disposable from '../disposable';
import { debounce } from '../util';
import { MinidocToolbarAction, Toolbarable, MinidocToolbarEditor } from './toolbar-types';

export const minidocToolbar = (
  actions: MinidocToolbarAction[],
): EditorMiddlewareMixin<Toolbarable> => (next, editor) => {
  const result = editor as MinidocToolbarEditor;
  const root = h('header.minidoc-toolbar');
  const defaultMenu = h('.minidoc-default-menu');

  result.toolbar = {
    root,
    dispose: Disposable.initialize(root, () => {}).dispose,
    setMenu(el) {
      root.firstElementChild?.replaceWith(el || defaultMenu);
    },
  };

  // The toolbar buttons / actions.
  const btns = actions.map((b) => {
    b.init && b.init(result);
    return ToolbarButton(result, b);
  });

  root.append(defaultMenu);
  defaultMenu.append(...btns);

  // When the caret changes, we need to refresh the toolbar buttons so they
  // activate / deactivate (e.g. the bold button is active if the caret is in
  // a bold / strong tag).
  Dom.on(
    editor.root,
    'mini:caretchange',
    debounce(() => {
      const node = Rng.currentNode();
      node && btns.forEach((b: any) => b.refreshState?.(result));
    }),
  );

  return next(result);
};

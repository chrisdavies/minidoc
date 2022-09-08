/**
 * This minidoc plugin adds a toolbar to the editor.
 */

import { EditorMiddleware } from '../types';
import * as Rng from '../range';
import { ToolbarButton } from './toolbar-button';
import * as Dom from '../dom';
import { h } from '../dom';
import * as Disposable from '../disposable';
import { debounce } from '../util';
import { MinidocToolbarAction, Toolbarable, MinidocToolbarEditor } from './toolbar-types';
import { ensureSelectionWithin } from '../range';

export const minidocToolbar =
  (actions: MinidocToolbarAction[]): EditorMiddleware<Toolbarable> =>
  (next, editor) => {
    const result = editor as MinidocToolbarEditor;
    const root = h('header.minidoc-toolbar', { tabIndex: -1 });

    // The toolbar buttons / actions.
    const btns = actions.map((b, i) => {
      b.init && b.init(result);
      const btn = ToolbarButton(result, b);
      btn.tabIndex = i === 0 ? 0 : -1;
      return btn;
    });

    const defaultMenu = h('.minidoc-default-menu', {
      onmousedown() {
        ensureSelectionWithin(editor.root);
      },
      onkeydown(e: KeyboardEvent) {
        // It's a nuisance to have to tab through all of the buttons in the
        // toolbar when you're trying to move focus past the toolbar to the
        // rich content or another form element, so what we do is set tabIndex
        // to -1 for all toolbar buttons but one. We use left / right to shift
        // focus to the appropriate buttons, and we change the tabIndex so the
        // last button we focused will gain focus when we tab back to it.
        const directions: Record<string, number> = {
          ArrowLeft: -1,
          ArrowRight: 1,
        };
        const direction = directions[e.code];
        const btnIndex = btns.indexOf(document.activeElement as HTMLButtonElement);
        if (direction && btnIndex >= 0) {
          const nextBtn = btns[Math.min(Math.max(0, btnIndex + direction), btns.length - 1)];
          btns[btnIndex].tabIndex = -1;
          nextBtn.tabIndex = 0;
          nextBtn.focus();
        }
      },
    });

    result.toolbar = {
      root,
      dispose: Disposable.initialize(root, () => {}).dispose,
      setMenu(el) {
        // This helps programs that have a dynamically shown / hidden toolbar,
        // as they generally want to hide the toolbar when neither the
        // editor or toolbar have focus, but without this, the toolbar loses
        // focus.
        el && root.focus();

        // This keeps the alignment from getting weird when the submenu
        // is significantly narrower than the original toolbar.
        root.style.minWidth = el ? `${root.getBoundingClientRect().width}px` : '';
        root.firstElementChild?.replaceWith(el || defaultMenu);
      },
    };

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

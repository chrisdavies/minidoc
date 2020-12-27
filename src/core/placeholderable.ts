import * as Dom from '../dom';
import { EditorMiddleware } from '../minidoc-types';

/**
 * Attach placeholder support to the specified editor.
 */
export const placeholderable = (placeholder: string): EditorMiddleware => (next, editor) => {
  const el = editor.root;
  const updatePlaceholder = () => {
    const placeholderText =
      (el.childElementCount <= 1 && Dom.isEmpty(el, true) && placeholder) || '';
    if (placeholderText !== el.getAttribute('placeholder')) {
      el.setAttribute('placeholder', placeholderText);
    }
  };

  // Any time the dom changes on our root element, we will check to see if
  // we need to add / remove the placeholder.
  Dom.on(el, 'mini:change', updatePlaceholder);

  // Add / remove the placeholder initially, as necessary.
  updatePlaceholder();

  return next(editor);
};

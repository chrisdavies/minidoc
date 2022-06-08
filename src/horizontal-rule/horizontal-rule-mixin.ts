import { h } from '../dom';
import * as Dom from '../dom';
import * as Rng from '../range';
import { inferMiddleware } from '../mixins';

/**
 * When the user types `---` at the start of a newline, we'll convert it
 * to a horizontal rule.
 */
export const horizontalRuleMixin = inferMiddleware((next, editor) => {
  editor.onSequence('---', (node: Node) => {
    const leaf = Dom.findLeaf(node)!;
    const hr = h('hr', { contenteditable: 'false' });
    leaf.replaceWith(hr);
    Rng.setCaretAtStart(Dom.insertAfter(Dom.newLeaf(), hr));
  });
  return next(editor);
});

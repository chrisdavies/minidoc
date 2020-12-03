import * as Dom from '../dom';
import { h } from '../dom';
import { onMount } from '../disposable';

/**
 * When the user hovers over a link in the editor content,
 * we need to show the url somewhere. This does so in a way
 * that is fairly similar (stylistically) to Chrome.
 */
export function linkHoverPreview(content: Element) {
  const el = h('.minidoc-href-preview');
  let href: string;
  onMount(content, () => [
    Dom.on(content, 'mouseover', (e: any) => {
      const newHref = e.target.href;
      if (href === newHref) {
        return;
      }
      href = newHref;
      el.textContent = href;
      if (href) {
        document.body.appendChild(el);
      } else {
        el.remove();
      }
    }),
    () => el.remove(),
  ]);
}

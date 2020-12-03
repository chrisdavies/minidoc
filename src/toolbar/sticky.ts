/**
 * Logic for making the toolbar sticky when its container / document scrolls.
 */

import * as Dom from '../dom';
import { h } from '../dom';
import { onMount } from '../disposable';
import { debounce } from '../util';

export function Sticky(child: Node) {
  const placeholder = h('div', { style: 'height: 0px' }) as HTMLDivElement;
  const el = h('div', placeholder, child);
  let isStuck = false;
  onMount(el, () =>
    Dom.on(
      el.closest('.minidoc-scroll-container') || window,
      'scroll',
      debounce(() => {
        const bounds = el.getBoundingClientRect();
        const shouldBeStuck = bounds.y < 0;
        if (shouldBeStuck !== isStuck) {
          isStuck = shouldBeStuck;
          el.classList.toggle('minidoc-toolbar-stuck', isStuck);
          Dom.assignAttrs({ style: `height: ${isStuck ? bounds.height : 0}px` }, placeholder);
        }
      }),
    ),
  );

  return el;
}

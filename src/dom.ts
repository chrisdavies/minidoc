/**
 * Add event listener to the element, and return the dispose / off function.
 */
export function on<
  K extends keyof HTMLElementEventMap,
  T extends Pick<Element, 'addEventListener' | 'removeEventListener'>
>(el: T, evt: K, fn: (e: HTMLElementEventMap[K]) => any, opts?: boolean | EventListenerOptions) {
  el.addEventListener(evt, fn as any, opts);
  return () => el.removeEventListener(evt, fn as any, opts);
}

/**
 * Create a function which runs at most every n ms.
 * @param {function} fn
 * @param {number} [ms]
 */
export function debounce(fn: () => void, ms = 100) {
  let timeout: any;
  const tick = () => {
    timeout = undefined;
    return fn();
  };
  return () => {
    if (timeout) {
      return;
    }
    timeout = setTimeout(tick, ms);
  };
}

export function compose<T extends (arg: any) => any>(a: T, b: T): T {
  return (((arg: any) => b(a(arg))) as unknown) as T;
}

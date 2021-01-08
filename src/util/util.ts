/**
 * Create a function which runs at most every n ms.
 * @param {function} fn
 * @param {number} [ms]
 */
export function debounce(fn: (...args: any) => void, ms = 100) {
  let timeout: any;
  let finalArgs: any;
  const tick = () => {
    timeout = undefined;
    fn(...finalArgs);
    finalArgs = undefined;
  };
  return (...args: any) => {
    finalArgs = args;
    if (timeout) {
      return;
    }
    timeout = setTimeout(tick, ms);
  };
}

export function compose<T extends (arg: any) => any>(a: T, b: T): T {
  return (((arg: any) => b(a(arg))) as unknown) as T;
}

export function chain<T extends (...args: any) => any>(a: T, b: T): T {
  return ((...args: any) => {
    a(...args);
    return b(...args);
  }) as T;
}

export function last<T>(list: { [i: number]: T; length: number }): T | undefined {
  return list[list.length - 1];
}

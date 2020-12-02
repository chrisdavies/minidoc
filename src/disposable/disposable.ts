/**
 * We need to initialize components when they are added to the DOM, and
 * we need to dispose them when they're removed. These functions are responsible
 * for that. Originally, this kept track of disposables via an efficient
 * tree, but it turns out querySelectorAll is fast enough for our purposes,
 * and we can use the DOM as our tree.
 */

type DisposeFn = () => void;
type DisposableInit = () => DisposeFn | DisposeFn[];

interface Disposable {
  inits: Array<DisposableInit>;
  isInitialized?: boolean;
  dispose?(): void;
}

function initDisposable(el: Element) {
  const disposable: Disposable | undefined = (el as any)?.disposable;
  if (!disposable || disposable.isInitialized) {
    return;
  }
  disposable.isInitialized = true;
  disposable.inits.forEach((f) => {
    const result = f();
    if (!result) {
      return;
    }
    const dispose = typeof result === 'function' ? result : () => result.forEach((f) => f());
    const prevDispose = disposable.dispose;
    disposable.dispose = () => {
      prevDispose && prevDispose();
      dispose();
    };
  });
}

function dispose(el: Element) {
  const disposable: Disposable | undefined = (el as any)?.disposable;
  if (!disposable?.isInitialized) {
    return;
  }
  disposable.isInitialized = false;
  disposable.dispose?.();
}

/**
 * The element was mounted in the DOM. Crawl the disposable tree and initialize
 * all the things.
 */
export function elementMounted(el: Node) {
  if (el instanceof Element) {
    initDisposable(el);
    el.querySelectorAll('[disposable]').forEach((el) => initDisposable(el));
  }
}

/**
 * The element was unmounted from the DOM. Crawl the disposable tree and dispose
 * all the things.
 */
function elementUnmounted(el: Node) {
  if (el instanceof Element) {
    dispose(el);
    el.querySelectorAll('[disposable]').forEach((el) => dispose(el));
  }
}

/**
 * When the specified element is mounted, fn will run. If fn returns
 * a function, that returned function will be called when el unmounts.
 */
export function onMount(el: Element, fn: DisposableInit) {
  const x = (el as unknown) as { disposable: Disposable };
  if (!x.disposable) {
    el.setAttribute('disposable', 'true');
    x.disposable = { inits: [] };
  }
  x.disposable.inits.push(fn);
  return el;
}

/**
 * Attach auto-dispose behavior to el and all of its current and future children.
 * If el itself is removed from the DOM, this will not handle that. The return
 * function must be called manually in that case.
 */
export function initialize(el: Element): Element & { dispose(): void } {
  const observer = new MutationObserver((mutationsList) => {
    for (let mutation of mutationsList) {
      mutation.addedNodes.forEach((addedNode) => {
        if (addedNode.isConnected) {
          elementMounted(addedNode);
        }
      });
      mutation.removedNodes.forEach((removedNode) => {
        if (!removedNode.isConnected) {
          elementUnmounted(removedNode);
        }
      });
    }
  });
  observer.observe(el, { childList: true, subtree: true });
  const result: any = el;
  result.dispose = () => {
    elementUnmounted(el);
    observer.disconnect();
  };
  return result;
}

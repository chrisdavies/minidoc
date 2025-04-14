/**
 * We need to initialize components when they are added to the DOM, and
 * we need to dispose them when they're removed. These functions are responsible
 * for that. Originally, this kept track of disposables via an efficient
 * tree, but it turns out querySelectorAll is fast enough for our purposes,
 * and we can use the DOM as our tree.
 */

export type Disposable = {
  /**
   * Clean up any global effects / events.
   */
  dispose(): void;
};

export type Observable = {
  pauseChanges(fn: () => void): void;
};

type DisposeFn = () => void;
type DisposableInit = () => void | DisposeFn | DisposeFn[];

interface DisposableInst {
  inits: Array<DisposableInit>;
  isInitialized?: boolean;
  dispose?(): void;
}

function addDisposer(disposable: DisposableInst, f: DisposableInit) {
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
}

function initDisposable(el: Element) {
  const disposable: DisposableInst | undefined = (el as any)?.disposable;
  if (!disposable || disposable.isInitialized) {
    return;
  }
  disposable.isInitialized = true;
  disposable.inits.forEach((f) => addDisposer(disposable, f));
}

function dispose(el: Element) {
  const disposable: DisposableInst | undefined = (el as any)?.disposable;
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
  const x = el as unknown as { disposable: DisposableInst };
  if (!x.disposable) {
    el.setAttribute('disposable', 'true');
    x.disposable = { inits: [] };
  }
  x.disposable.inits.push(fn);
  // If the element is already mounted, we need to immediately call onMount
  if (x.disposable.isInitialized) {
    addDisposer(x.disposable, fn);
  }
  return el;
}

/**
 * Attach auto-dispose behavior to el and all of its current and future children.
 * If el itself is removed from the DOM, this will not handle that. The return
 * function must be called manually in that case.
 */
export function initialize<T extends Element>(
  el: T,
  onChange: () => void,
): T & Disposable & Observable {
  let paused = 0;
  const observer = new MutationObserver((mutationsList) => {
    if (paused > 0) {
      --paused;
    } else {
      onChange();
    }

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
  const result = el as T & Disposable & Observable;

  result.dispose = () => {
    elementUnmounted(el);
    el.remove();
    observer.disconnect();
  };

  result.pauseChanges = (fn) => {
    ++paused;
    fn();
  };

  observer.observe(el, { childList: true, subtree: true, characterData: true, attributes: true });
  elementMounted(onMount(el, () => {}));
  return result;
}

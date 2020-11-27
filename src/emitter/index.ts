type BasicHandler = () => any;

export function createEmitter<T extends string>() {
  const fns = new Map<string, Set<BasicHandler>>();

  return {
    on(evt: T, handler: BasicHandler): () => void {
      const handlers = fns.get(evt) || new Set<BasicHandler>();
      fns.set(evt, handlers);
      handlers.add(handler);
      return () => {
        handlers.delete(handler);
      };
    },
    emit(evt: T) {
      const handlers = fns.get(evt);
      handlers && handlers.forEach((fn) => fn());
    },
  };
}

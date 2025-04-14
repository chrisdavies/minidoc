import { makeUndoRedo, UndoRedoOptions } from './undo-redo';

const createUndoRedo = (options: Partial<UndoRedoOptions<string>> = {}) => {
  let $setValue = { value: '' };
  const defaultOpts: UndoRedoOptions<string> = {
    initialState: '',
    setState(state) {
      $setValue.value = state;
    },
  };
  const undoRedo = makeUndoRedo({ ...defaultOpts, ...options });
  return { undoRedo, $setValue };
};

describe('undo-redo', () => {
  describe('basic operations', () => {
    it('should track state changes', () => {
      const { undoRedo } = createUndoRedo();

      // Initial state
      expect(undoRedo.canUndo).toBe(false);
      expect(undoRedo.canRedo).toBe(false);

      // Push first state
      undoRedo.push('state1');
      undoRedo.commitState();
      expect(undoRedo.canUndo).toBe(true);
      expect(undoRedo.canRedo).toBe(false);

      // Push second state
      undoRedo.push('state2');
      undoRedo.commitState();
      expect(undoRedo.canUndo).toBe(true);
      expect(undoRedo.canRedo).toBe(false);
    });

    it('should undo and redo state changes', () => {
      const { undoRedo, $setValue } = createUndoRedo({ initialState: 'foo' });

      undoRedo.push('a');
      undoRedo.commitState();

      undoRedo.push('b');
      undoRedo.commitState();

      expect(undoRedo.undo()).toBeTrue();
      expect($setValue.value).toEqual('a');
      expect(undoRedo.undo()).toBeTrue();
      expect($setValue.value).toEqual('foo');
      expect(undoRedo.undo()).toBeFalse();
    });
  });

  describe('history limits', () => {
    it('should respect maxHistory limit', () => {
      const { undoRedo, $setValue } = createUndoRedo({ maxHistory: 2 });

      undoRedo.push('1');
      undoRedo.commitState();
      undoRedo.push('2');
      undoRedo.commitState();
      undoRedo.push('3');
      undoRedo.commitState();
      undoRedo.push('4');
      undoRedo.commitState();

      expect(undoRedo.undo()).toBe(true);
      expect($setValue.value).toBe('3');
      expect(undoRedo.undo()).toBe(true);
      expect($setValue.value).toBe('2');
      expect(undoRedo.undo()).toBe(false);
      expect($setValue.value).toBe('2');
    });
  });
});

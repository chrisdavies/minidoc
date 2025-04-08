import { makeUndoRedo, UndoRedoOptions } from './undo-redo';

const createProvider = (id: string, currentState: string | null = null) => {
  const result = {
    id,
    $setStateValue: currentState,
    currentState,
    setState: (state: string | null) => {
      result.$setStateValue = state;
    },
  };
  return result;
};

const createUndoRedo = (options: UndoRedoOptions = { delay: 0 }) => {
  const undoRedo = makeUndoRedo(options);
  const provider = createProvider('test-provider');
  undoRedo.registerProvider(provider);
  return { undoRedo, provider };
};

describe('undo-redo', () => {
  describe('basic operations', () => {
    it('should track state changes', () => {
      const { undoRedo, provider } = createUndoRedo();

      // Initial state
      expect(undoRedo.canUndo).toBe(false);
      expect(undoRedo.canRedo).toBe(false);

      // Push first state
      undoRedo.push({ id: provider.id, state: 'state1' });
      expect(undoRedo.canUndo).toBe(true);
      expect(undoRedo.canRedo).toBe(false);

      // Push second state
      undoRedo.push({ id: provider.id, state: 'state2' });
      expect(undoRedo.canUndo).toBe(true);
      expect(undoRedo.canRedo).toBe(false);
    });

    it('should undo and redo state changes', () => {
      const { undoRedo } = createUndoRedo();
      const a = createProvider('pa');
      const b = createProvider('pb');
      undoRedo.registerProvider(a);
      undoRedo.registerProvider(b);
      undoRedo.push({ id: a.id, state: '1' });
      undoRedo.push({ id: b.id, state: '2' });
      undoRedo.push({ id: a.id, state: '3' });

      expect(undoRedo.canRedo).toBeFalse();
      expect(undoRedo.canUndo).toBeTrue();
      expect(undoRedo.undo()).toBe(true);
      expect(undoRedo.canRedo).toBeTrue();
      expect(a.$setStateValue).toBe('1');
      expect(b.currentState).toBe('2');
      expect(undoRedo.undo()).toBe(true);
      expect(a.currentState).toBe('1');
      expect(b.$setStateValue).toBe(null);
      expect(undoRedo.undo()).toBe(true);
      expect(a.$setStateValue).toBe(null);
      expect(b.currentState).toBe(null);
      expect(undoRedo.canRedo).toBeTrue();
      expect(undoRedo.canUndo).toBeFalse();
    });
  });

  describe('state pushing and committing', () => {
    it('should handle getValue function', () => {
      const { undoRedo } = createUndoRedo();
      const a = createProvider('pa');
      const b = createProvider('pb');
      undoRedo.registerProvider(a);
      undoRedo.registerProvider(b);

      undoRedo.push({ id: a.id, getValue: () => 'a-1' });
      undoRedo.push({ id: b.id, state: 'b-1' });
      undoRedo.push({ id: a.id, getValue: () => 'a-2' });
      undoRedo.push({ id: b.id, state: 'b-2' });

      expect(a.currentState).toBe('a-2');
      expect(undoRedo.undo()).toBe(true);
      expect(b.$setStateValue).toBe('b-1');
      expect(undoRedo.undo()).toBe(true);
      expect(a.$setStateValue).toBe('a-1');
    });

    it('should not push duplicate states', () => {
      const { undoRedo, provider } = createUndoRedo();
      undoRedo.push({ id: provider.id, state: 'state1' });
      undoRedo.push({ id: provider.id, state: 'state1' });
      expect(undoRedo.canUndo).toBe(true);
      expect(undoRedo.undo()).toBe(true);
      expect(provider.$setStateValue).toBe(null);
    });
  });

  describe('history limits', () => {
    it('should respect maxHistory limit', () => {
      const { undoRedo } = createUndoRedo({ maxHistory: 3 });
      const a = createProvider('pa');
      const b = createProvider('pb');
      undoRedo.registerProvider(a);
      undoRedo.registerProvider(b);

      undoRedo.push({ id: a.id, state: 'state1' });
      undoRedo.push({ id: b.id, state: 'state2' });
      undoRedo.push({ id: a.id, state: 'state3' });
      undoRedo.push({ id: b.id, state: 'state4' });

      expect(undoRedo.undo()).toBe(true);
      expect(a.currentState).toBe('state3');
      expect(b.currentState).toBe('state2');
      expect(undoRedo.undo()).toBe(true);
      expect(a.currentState).toBe('state1');
      expect(b.currentState).toBe('state2');
      expect(undoRedo.undo()).toBe(true);
      expect(undoRedo.undo()).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle undo when no history exists', () => {
      const { undoRedo } = createUndoRedo();
      expect(undoRedo.undo()).toBe(false);
    });

    it('should handle redo when no future states exist', () => {
      const { undoRedo } = createUndoRedo();
      expect(undoRedo.redo()).toBe(false);
    });

    it('should handle unknown provider IDs', () => {
      const { undoRedo } = createUndoRedo();
      undoRedo.push({ id: 'unknown-provider', state: 'state1' });
      expect(undoRedo.canUndo).toBe(false);
    });
  });
});

import FakeTimers from '@sinonjs/fake-timers';
import { undoRedo } from './undo-redo';

export function fakeClock() {
  let clock: FakeTimers.InstalledClock;

  beforeEach(() => {
    clock = FakeTimers.install();
  });

  afterEach(() => {
    clock.uninstall();
  });

  return {
    get clock() {
      return clock;
    },
    runAll: () => clock.runAll(),
    tick(n: number) {
      return clock.tick(n);
    },
  };
}

describe('undoHistory', () => {
  const timers = fakeClock();

  it('Undo and redo goes back and forth through history', () => {
    let doc = 'hello world';
    const ur = undoRedo(
      { doc, ctx: 0 },
      () => ({ doc, ctx: 0 }),
      () => {},
    );

    doc = 'hello world and folks';
    ur.commit();
    doc = 'hello world or folks';
    ur.commit();

    expect(ur.undo().doc).toEqual('hello world and folks');
    expect(ur.undo().doc).toEqual('hello world');
    // Check we don't go past the start!
    expect(ur.undo().doc).toEqual('hello world');

    expect(ur.redo().doc).toEqual('hello world and folks');
    expect(ur.redo().doc).toEqual('hello world or folks');
    // Check we don't go past the end!
    expect(ur.redo().doc).toEqual('hello world or folks');
  });

  it('Buffers changes', () => {
    let doc = 'a';
    const ur = undoRedo(
      { doc, ctx: 0 },
      () => ({ doc, ctx: 0 }),
      () => {},
    );

    ur.onChange();
    doc = 'abc';
    timers.runAll();

    doc = 'abcde';
    ur.onChange();
    timers.runAll();

    expect(ur.undo().doc).toEqual('abc');
    expect(ur.undo().doc).toEqual('a');

    expect(ur.redo().doc).toEqual('abc');
    expect(ur.redo().doc).toEqual('abcde');
  });

  it('Changes clear redo history', () => {
    let doc = 'a';
    const ur = undoRedo(
      { doc, ctx: 0 },
      () => ({ doc, ctx: 0 }),
      () => {},
    );

    doc = 'ab';
    ur.commit();
    doc = 'abc';
    ur.commit();
    doc = 'abcd';
    ur.commit();

    expect(ur.undo().doc).toEqual('abc');
    expect(ur.undo().doc).toEqual('ab');

    doc = 'abz';
    ur.commit();

    expect(ur.undo().doc).toEqual('ab');
    expect(ur.undo().doc).toEqual('a');
    expect(ur.redo().doc).toEqual('ab');
    expect(ur.redo().doc).toEqual('abz');
    expect(ur.redo().doc).toEqual('abz');
  });

  it('Undo and redo commit the buffer before running', () => {
    let doc = 'a';
    const ur = undoRedo(
      { doc, ctx: 0 },
      () => ({ doc, ctx: 0 }),
      () => {},
    );

    doc = 'a quazar';
    ur.commit();
    doc = 'a quazar is amazing';
    ur.onChange();
    expect(ur.undo().doc).toEqual('a quazar');
    expect(ur.redo().doc).toEqual('a quazar is amazing');

    expect(ur.undo().doc).toEqual('a quazar');
    expect(ur.undo().doc).toEqual('a');
  });
});

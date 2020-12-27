import { diff, undo, redo } from './strdiff';

describe('diff', () => {
  it('Computes the diff between two strings w/ middle deletion', () => {
    const s1 = 'Polkadots!';
    const s2 = 'Polks!';

    expect(diff(s1, s2)).toEqual([4, 'adot', '']);
  });

  it('Computes the diff between two strings w/ end deletion', () => {
    const s1 = 'Polkadots!';
    const s2 = 'Polkadot';

    expect(diff(s1, s2)).toEqual([8, 's!', '']);
  });

  it('Computes the diff between two strings w/ front deletion', () => {
    const s1 = 'dots!';
    const s2 = 'Polkadots!';

    expect(diff(s1, s2)).toEqual([0, '', 'Polka']);
  });

  it('Computes the diff between two strings w/ middle addition', () => {
    const s1 = 'Polkadots!';
    const s2 = 'Polkabeardots!';

    expect(diff(s1, s2)).toEqual([5, '', 'bear']);
  });

  it('Computes the diff between two strings w/ end addition', () => {
    const s1 = 'Polkadots!';
    const s2 = 'Polkadots! Rock!';

    expect(diff(s1, s2)).toEqual([10, '', ' Rock!']);
  });

  it('Computes the diff between two strings w/ front addition', () => {
    const s1 = 'Polkadots!';
    const s2 = 'Red Polkadots!';

    expect(diff(s1, s2)).toEqual([0, '', 'Red ']);
  });

  it('The same string returns a falsy value', () => {
    const s1 = 'Polkadots!';
    const s2 = 'Polkadots!';

    expect(diff(s1, s2)).toBeFalsy();
  });

  it('Empty to full', () => {
    const s1 = '';
    const s2 = 'Polkadots!';

    expect(diff(s1, s2)).toEqual([0, '', 'Polkadots!']);
  });

  it('Full to empty', () => {
    const s1 = 'Polkadots!';
    const s2 = '';

    expect(diff(s1, s2)).toEqual([0, 'Polkadots!', '']);
  });
});

describe('undo and redo', () => {
  function testundo(s1: string, s2: string) {
    expect(undo(s2, diff(s1, s2))).toEqual(s1);
    expect(redo(s1, diff(s1, s2))).toEqual(s2);
  }

  it('undo w/ middle deletion', () => {
    testundo('Polkadots!', 'Polks!');
  });

  it('undo w/ end deletion', () => {
    testundo('Polkadots!', 'Polkadot');
  });

  it('undo w/ front deletion', () => {
    testundo('dots!', 'Polkadots!');
  });

  it('undo w/ middle addition', () => {
    testundo('Polkadots!', 'Polkabeardots!');
  });

  it('undo w/ end addition', () => {
    testundo('Polkadots!', 'Polkadots! Rock!');
  });

  it('undo w/ front addition', () => {
    testundo('Polkadots!', 'Red Polkadots!');
  });
});

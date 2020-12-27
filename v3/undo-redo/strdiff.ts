export type StrDelta = [number, string, string];

const applyDelta = (s: string, fromIndex: 1 | 2, toIndex: 1 | 2, delta?: StrDelta) =>
  !delta ? s : s.slice(0, delta[0]) + delta[fromIndex] + s.slice(delta[0] + delta[toIndex].length);

/**
 * Produce a delta of the two strings which can then be applied:
 * const delta = diff(s1, s2);
 * s2 === redo(s1, delta)
 * s1 === undo(s2, delta)
 * The delta is an array like so: [index, oldString, newString]
 * Where index is the first position where the strings differ, and
 * oldString is the section of s1 that differs from s2, and newString
 * is the section of s2 that differs from s1.
 */
export function diff(s1: string, s2: string): StrDelta | undefined {
  if (s1 === s2) {
    return;
  }
  let startIndex = 0;
  while (startIndex < s1.length && startIndex < s2.length && s1[startIndex] === s2[startIndex]) {
    ++startIndex;
  }
  let x1 = s1.length;
  let x2 = s2.length;
  while (x1 > startIndex && x2 > startIndex && s1[x1 - 1] === s2[x2 - 1]) {
    --x1;
    --x2;
  }
  return [startIndex, s1.slice(startIndex, x1), s2.slice(startIndex, x2)];
}

/**
 * Undo the specified delta.
 */
export const undo = (s: string, delta?: StrDelta) => applyDelta(s, 1, 2, delta);

/**
 * Redo the specified delta.
 */
export const redo = (s: string, delta?: StrDelta) => applyDelta(s, 2, 1, delta);

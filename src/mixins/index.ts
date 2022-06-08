import { EditorMiddleware, MinidocBase } from '../types';

type EditorVoidMiddleware<TEditor extends MinidocBase = any> = (
  next: <Y extends MinidocBase>(editor: Y) => Y,
  editor: TEditor,
) => void;

export function inferMiddleware(middleware: EditorVoidMiddleware) {
  return middleware as EditorMiddleware<{ $?: string }, MinidocBase>;
}

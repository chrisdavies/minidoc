import { DetachedRange } from './range';

export type EditorState = {
  doc: string;
  selection?: DetachedRange;
};

export interface MinidocBase {
  root: HTMLElement;
  readonly?: boolean;
}

export interface MinidocOptions<T extends Array<EditorMiddleware>> {
  /**
   * The raw document as HTML.
   */
  doc: string;
  /**
   * Whether or not the document is editable or simply viewable.
   */
  readonly?: boolean;
  /**
   * If specified, this is the contenteditable used to render the document.
   */
  root?: HTMLElement;
  /**
   * The set of middleware used in this document.
   */
  middleware?: T;
}

export type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (
  k: infer I,
) => void
  ? I
  : never;

export type ReturnTypesIntersection<T> =
  T extends Array<(...args: any[]) => infer U> ? UnionToIntersection<Exclude<U, void>> : any;

export type EditorMiddleware<
  TExtension extends any = any,
  TEditor extends MinidocBase = MinidocBase,
> = (next: <Y extends MinidocBase>(editor: Y) => Y, editor: TEditor) => TEditor & TExtension;

export type ImmutableLeaf = HTMLElement & { $immutable: true };

export interface MinidocBase {
  root: Element;
  readonly?: boolean;
  singleLine?: boolean;
}

export interface MinidocOptions<T extends Array<EditorMiddleware | EditorMiddlewareMixin>> {
  /**
   * The raw document as HTML.
   */
  doc: string;
  /**
   * Whether or not the document is editable or simply viewable.
   */
  readonly?: boolean;
  /**
   * If true, it prevents line breaks.
   */
  singleLine?: boolean;
  /**
   * If specified, this is the contenteditable used to render the document.
   */
  root?: Element;
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

export type ReturnTypesIntersection<T> = T extends Array<(...args: any[]) => infer U>
  ? UnionToIntersection<U>
  : any;

export type EditorMiddleware<TEditor extends MinidocBase = any> = (
  next: <Y extends MinidocBase>(editor: Y) => Y,
  editor: TEditor,
) => void;

export type EditorMiddlewareMixin<
  TExtension extends any = any,
  TEditor extends MinidocBase = MinidocBase
> = (next: <Y extends MinidocBase>(editor: Y) => Y, editor: TEditor) => TEditor & TExtension;

export type ImmutableLeaf = Element & { $immutable: true };

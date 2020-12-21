/**
 * The first-class events emitted by the editor.
 */
export type MinidocEvent = 'caretchange' | 'edit' | 'undocapture';

export type Uploader = (opts: {
  file: File;
  onProgress: (progress: number) => void;
}) => { promise: Promise<any>; cancel(): void };

export interface Emitter<T> {
  emit(event: T): void;
}

export interface Subscribable<T> {
  on(event: T, handler: () => any): () => any;
}

export type Eventable<T> = Emitter<T> & Subscribable<T>;

export interface Rootable {
  root: Element;
}

export interface Mediable {
  insertMedia(file: File): void;
}

/**
 * This data structure is used to track a caret position when dealing with undo / redo.
 */
export interface DetachedPosition {
  /**
   * The range offset.
   */
  offset: number;
  /**
   * The path of offsets that, if followed, will take you from the editor root
   * to a descendant node which will be selected.
   */
  path: number[];
}

/**
 * A Range which can be restored on a different DOM tree than the one from on which it was created.
 */
export interface DetachedRange {
  start: DetachedPosition;
  end?: DetachedPosition;
}

/**
 * Constructor options for the minidoc editor.
 */
export interface MinidocOptions {
  doc: string;
  placeholder?: string;
  plugins?: MinidocPlugin[];
}

/**
 * The document and related context associated with an undo / redo event.
 * The context is generally a DetachedRange, but is generic for testing purposes.
 */
export interface UndoHistoryState<T> {
  doc: string;
  ctx: T;
}

export interface UndoHistory<T> {
  setContext(ctx: T): void;
  onChange(): void;
  commit(): void;
  undo(): UndoHistoryState<T>;
  redo(): UndoHistoryState<T>;
}

export interface Disposable {
  dispose(): void;
}

export type MinidocDropHandler = (e: DragEvent, target: HTMLElement) => Element | undefined | void;

export interface MindocDragDrop {
  isDragging: boolean;
  begin(e: DragEvent, onDrop: MinidocDropHandler): void;
}

export interface MinidocEditor extends Eventable<MinidocEvent>, Rootable, Disposable {
  toolbar?: MinidocToolbar;
  dragDrop: MindocDragDrop;

  isActive(tag: string): boolean;
  toggleBlock(tag: string): void;
  toggleInline(tag: string): void;
  toggleList(tag: 'ol' | 'ul'): void;
  caretChanged(): void;
  serialize(): string;

  undo(): void;
  redo(): void;
  undoHistory: UndoHistory<DetachedRange>;

  //
  // Extension points for plugins to override
  //
  beforeMount<T extends ParentNode & Node>(el: T): T;
  beforeSerialize(el: Element): Element;
}

export type ImmutableLeaf = Element & { $immutable: true };

export interface MinidocToolbar {
  root: Element;
  setMenu(el?: Element): void;
  dispose(): void;
}

export interface MinidocToolbarAction {
  id: string;
  label?: string;
  html: string;
  run(editor: MinidocToolbarEditor): any;
  isActive?(editor: MinidocToolbarEditor): boolean;
  init?(editor: MinidocToolbarEditor): void;
}

export interface Toolbarable {
  toolbar: MinidocToolbar;
}

export interface CardRenderOptions {
  state: any;
  editor: MinidocEditor;
  stateChanged(state: any): void;
}

export interface MinidocCardDefinition {
  type: string;
  render(opts: CardRenderOptions): Element;
}

export type MinidocToolbarEditor = MinidocEditor & Toolbarable;

export type MinidocKeyboardHandler = (e: KeyboardEvent, ctx: MinidocEditor) => void;

export type MinidocPlugin = <T extends MinidocEditor>(editor: T) => T;

export interface CardPluginContext {
  definitions: { [type: string]: MinidocCardDefinition };
  activateCard(el: Element, activate: boolean): void;
  deactivateCards(): void;
  insert(type: string, initialState: any): void;
}

export type Cardable<T extends MinidocEditor = MinidocEditor> = T & { cards: CardPluginContext };

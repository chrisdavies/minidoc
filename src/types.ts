/**
 * The first-class events emitted by the editor.
 */
type MinidocEvent = 'caretchange';

/**
 * This data structure is used to track a caret position when dealing with undo / redo.
 */
interface DetachedPosition {
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
interface DetachedRange {
  start: DetachedPosition;
  end?: DetachedPosition;
}

/**
 * Constructor options for the minidoc editor.
 */
interface MinidocOptions {
  doc: string;
  plugins?: MinidocPlugin[];
  toolbarActions?: MinidocToolbarAction[];
}

/**
 * The document and related context associated with an undo / redo event.
 * The context is generally a DetachedRange, but is generic for testing purposes.
 */
interface UndoHistoryState<T> {
  doc: string;
  ctx: T;
}

interface UndoHistory<T> {
  onChange(): void;
  commit(): void;
  undo(): UndoHistoryState<T>;
  redo(): UndoHistoryState<T>;
}

interface MinidocCoreEditor {
  root: Element;
  toolbar?: MinidocToolbar;
  isWithin(tag: string): boolean;
  toggleBlock(tag: string): void;
  toggleInline(tag: string): void;
  toggleList(tag: 'ol' | 'ul'): void;
  on(event: MinidocEvent, handler: () => any): () => any;
  emit(event: MinidocEvent): void;
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

type ImmutableLeaf = Element & { $immutable: true };

interface MinidocToolbar {
  root: Element;
  setMenu(el?: Element): void;
}

interface Disposable {
  dispose(): void;
}

interface MinidocToolbarAction {
  id: string;
  label?: string;
  html: string;
  run(editor: MinidocToolbarEditor): any;
  isActive?(editor: MinidocToolbarEditor): boolean;
}

interface Toolbarable {
  toolbar: MinidocToolbar;
}

interface CardRenderOptions {
  state: any;
  editor: MinidocCoreEditor;
  stateChanged(state: any): void;
}

interface MinidocCardDefinition {
  type: string;
  render(opts: CardRenderOptions): Element;
}

type MinidocEditor = MinidocCoreEditor & Disposable & { container: Element };

type MinidocToolbarEditor = MinidocCoreEditor & Toolbarable;

type MinidocKeyboardHandler = (e: KeyboardEvent, ctx: MinidocCoreEditor) => void;

type MinidocPlugin = <T extends MinidocCoreEditor>(editor: T) => T;

interface CardPluginContext {
  definitions: { [type: string]: MinidocCardDefinition };
  activateCard(el: Element, activate: boolean): void;
  deactivateCards(): void;
  insert(type: string, initialState: any): void;
}

type Cardable<T extends MinidocCoreEditor = MinidocCoreEditor> = T & { cards: CardPluginContext };

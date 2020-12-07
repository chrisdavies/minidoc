type MinidocEvent = 'caretchange';

interface MinidocOptions {
  doc: string;
  plugins?: MinidocPlugin[];
  toolbarActions?: MinidocToolbarAction[];
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

  //
  // Extension points for plugins to override
  //
  beforeMount(el: Element): Element;
  beforeSerialize(el: Element): Element;
}

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

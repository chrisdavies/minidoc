type MinidocEvent = 'caretchange';

interface MinidocCoreEditor {
  root: Element;
  toolbar?: MinidocToolbar;
  isWithin(tag: string): boolean;
  toggleBlock(tag: string): void;
  toggleInline(tag: string): void;
  toggleList(tag: 'ol' | 'ul'): void;
  on(event: MinidocEvent, handler: () => any): () => any;
  emit(event: MinidocEvent): void;
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

type MinidocEditor = MinidocCoreEditor & Disposable;

type MinidocToolbarEditor = MinidocCoreEditor & Toolbarable;

type MinidocKeyboardHandler = (e: KeyboardEvent, ctx: MinidocCoreEditor) => void;

interface MinidocPlugin {
  name: string;
  onKeydown?: MinidocKeyboardHandler;
}

type MinidocEvent = 'caretchange';

interface MinidocEditor {
  root: Element;
  isWithin(tag: string): boolean;
  toggleBlock(tag: string): void;
  toggleInline(tag: string): void;
  on(event: MinidocEvent, handler: () => any): () => any;
  emit(event: MinidocEvent): void;
}

type MinidocKeyboardHandler = (e: KeyboardEvent, ctx: MinidocEditor) => void;

interface MinidocPlugin {
  name: string;
  onKeydown?: MinidocKeyboardHandler;
}

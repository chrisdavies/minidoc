interface MinidocEditor {
  root: Element;
  isWithin(tag: string): boolean;
  toggleBlock(tag: string): void;
  toggleInline(tag: string): void;
}

type MinidocKeyboardHandler = (e: KeyboardEvent, ctx: MinidocEditor) => void;

interface MinidocPlugin {
  name: string;
  onKeydown?: MinidocKeyboardHandler;
}

interface MinidocEditor {
  root: Element;
  isWithin(tag: string): boolean;
}

type MinidocKeyboardHandler = (e: KeyboardEvent, ctx: MinidocEditor) => void;

interface MinidocPlugin {
  name: string;
  onKeydown?: MinidocKeyboardHandler;
}

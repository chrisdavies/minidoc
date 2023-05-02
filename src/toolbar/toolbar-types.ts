import { MinidocCore } from '../minidoc';

export interface MinidocToolbar {
  root: Element;
  setMenu(el?: Element): void;
  dispose(): void;
}

export interface Toolbarable {
  toolbar: MinidocToolbar;
}

export type MinidocToolbarEditor = MinidocCore & Toolbarable;

export interface MinidocToolbarAction {
  id: string;
  label?: string;
  html: string;
  run(editor: MinidocToolbarEditor): any;
  isActive?(editor: MinidocToolbarEditor): boolean;
  init?(editor: MinidocToolbarEditor): void;
  onMouseDown?: HTMLElement['onmousedown'];
}

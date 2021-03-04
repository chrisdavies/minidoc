# Quickstart

## Installation

```
npm install minidoc-editor
```

## Usage

Getting a basic editor up and running is as simple as this:

```ts
import {
  minidoc,
  minidocToolbar,
  defaultToolbarActions,
  placeholder,
} from 'minidoc-editor';

const editor = minidoc({
  // The editor content
  doc: `<h1>Hello, world!</h1><p>This is a document.</p>`,

  // Setup the desired editor behaviors.
  middleware: [
    // Placeholder text
    placeholder('Type something fanci here.'),
    // The toolbar
    minidocToolbar(defaultToolbarActions),
  ],
});

// Add the editor to the DOM
document.body.append(editor.toolbar.root, editor.root);

```

## Images, videos, etc

Out of the box, minidoc doesn't support files / media. However, minidoc is built to be extended via middleware and cards. An example of how to create a media card can be found in [media-card.md](./media-card.md) and can also be seen in [demo.ts](../public/demo.ts).

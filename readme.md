# minidoc

Minidoc is a basic contenteditable sanitizer.

## Core

The core of minidoc is a pluggable editor that doesn't try to do much other than make contenteditable produce sane, clean markup.

```js
// Create an editor with the default plugins and settings
const editor = minidoc(document.querySelector('div'));

// When the caret position changes, this event will fire.
editor.on('caretchange', () => {
  if (editor.isWithin('h1')) {
    console.log('editing the title');
  }
});

editor.on('change', () => console.log(editor.serialize()));

const off = editor.on(eventName, handler);

editor.serialize();
editor.isWithin('h1');
editor.toggleBlock('h1');
editor.toggleInline('strong');
editor.toggleList('ol');
```

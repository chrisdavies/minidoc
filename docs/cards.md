# Cards

Minidoc comes with a middlware called `cardMiddleware` which allows you to define custom widgets that can be embedded within a document. These can be anything you wish such as image galleries, videos, surveys, polls, etc.

Example cards can be seen in [demo.ts](../public/demo.ts).

## Card basics

We'll go through an example card to see how they work. We'll build a "counter" card which adds a clickable button to the document. When you click the button, a counter is incremented.

```js
// Here, we define the counter card.
const counterCard = {
  // Cards in minidoc are represented by two properties: type and state.
  // type is simply a string used to identify the kind of card
  // state is the data associated with an instance of the card
  //
  // In a document, cards are represented via a custom dom element, with
  // the state being a JSON string.
  // <mini-card type="counter" state="0"></mini-card>
  type: 'counter',

  // Given the card options, return a DOM element that represents
  // the card. Opts has the following properties:
  // state - the instance-specific state
  // editor - the minidoc editor instance
  // stateChanged - a function which we can call to inform minidoc
  //              that our state has changed so that undo / redo works.
  render(opts) {
    let count = opts.state || 0;
    const btn = document.createElement('button');
    const setText = () => {
      btn.textContent = `Count = ${count}`;
    };
    btn.onclick = (e) => {
      ++count;
      setText();
      opts.stateChanged(count);
    };
    return btn;
  },
};
```

In order to use your card, you have to initialize minidoc with a cardMiddleware that knows about your card.

```js
import {
  minidoc,
  minidocToolbar,
  defaultToolbarActions,
  cardMiddleware,
} from 'minidoc-editor';

const editor = minidoc({
  doc: `<h1>Hello, world!</h1><p>This is a document.</p>`,
  middleware: [
    minidocToolbar(defaultToolbarActions),
    // This is the important new bit:
    cardMiddleware([counterCard]),
  ],
});

```

Lastly, to insert an isntance of your card into a document, you need to call `insertCard` like so:


```js
// Insert card takes the card type and the initial state, and inserts
// the card at the current selection.
editor.insertCard('counter', 42);
```

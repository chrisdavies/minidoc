# Cards

## Overview

A rich editing experience requires more than just text. Depending on the platform, you probably want to embed images, video, and audio. You may want to embedded PDFs, charts, surveys, live stock tickers, etc.

Many of these artifacts are outside the scope of a rich text editor. Even the handling of video or images often require customization. For example, you may want to transcode the video and replace it src with the transcoded result, or you may want to serve up all assets using s3's presigned URLs.

For this reason, all such artifacts are beyond the scope of the minidoc editor, but the editor does expose an extension called "cards" which allow applications to create their own, embeddable widgets that can live within a greater document.

## Document Structure

A minidoc document is a structure that looks something like this:

```ts
interface MinidocCard<T> {
  type: string;
  state: T;
}

interface MinidocDocument {
  doc: string;
  cards: MinidocCard[];
}
```

For example:

```js
{
  doc: `
    <h1>Welcome to minidoc</h1>
    <p>A very basic editor</p>
    <mini-card />
    <p>That ^^^ is the first card</p>
    <mini-card />
    <p>And that is another...</p>
  `,
  cards: [
    { type: 'foo', state: 'bar' },
    { type: 'stock', state: 'EQX' },
  ],
}
```

Any `<mini-card />` elements in the document will be replaced with the appropriate card from the cards array. The `card.type` property is used by minidoc to look the card up in its registry.

## Undo / redo

Cards can (and should) plug themselves into minidoc's undo / redo system. That way, when the user makes various changes to the document, they can undo / redo everything, including card-specific edits.

Here is a card definition that simply implements a button which, when you click it, increments a number and displays it as its text:


```js
const counterCard = {
  type: 'counter',
  initialState: 0,
  render(ctx) {
    const btn = document.createElement('button');
    const setValue = (value) => {
      btn.textContent = value;
    };
    btn.addEventListener('click', () => setValue(ctx.setState((x) => x + 1)));
    setValue(ctx.state);
    return btn;
  },
};
```

The render method is called only once per instance, and in the case of the previous example, an undo / redo operation that affects a counter card will simply destroy the previous element and recreate the card from scratch. This is obviously not very efficient, so minidoc exposes a mechanism for your cards to more efficiently hook into the undo / redo system.

Below is the same counter card, only this time, it is much more efficient in undo / redo operations:

```js
const counterCard = {
  type: 'counter',
  initialState: 0,
  render(ctx) {
    const btn = document.createElement('button');
    const setValue = (value) => {
      btn.textContent = value;
    };
    // Note, here we mutate ctx. Mutation makes me sad :/, but this has
    // some advantages, so we'll go with it.
    ctx.onStateChange = setValue;
    btn.addEventListener('click', () => ctx.setState((x) => x + 1));
    setValue(ctx.state);
    return btn;
  },
};
```

If a card has assigned the `onStateChange` property of its context object, minidoc will assume that the card knows how to handle undo / redo state changes and will not always destroy / rereate the card when undo / redo state affects it.

For complex cards, it might make sense to use something like Preact or Svelte which intelligently updates the card content when an undo / redo change happens.

Here's a Preact example of (almost) the same card:

```js
import { render } from 'preact';
import { useState, useEffect } from 'preact/hooks';

function Counter(ctx) {
  // Use Preact's useState hook to ensure that state changes cause
  // a redraw of the component.
  const [state, _setState] = useState(ctx.state);
  // Use the card's setState, rather than Preact's setState.
  const setState = ctx.setState;
  // Assign Preact's setState as the onStateChange handler, so that Preact's setState
  // is called any time our card's setState is called.
  ctx.onStateChange = _setState;

  return (
    <button
      onClick={(e) => setState((x) => x + 1)}
    >
      {state}
    </button>
  );
}

const preactCounterCard = {
  type: 'preactCounter',
  initialState: 0,
  render(ctx) {
    const el = document.createElement('div');
    render(<Counter ctx={ctx} />, el);
    return el;
  },
};
```

## Edit mode vs render mode

Most cards are not going to be as simple as our previous illustrations, and in most cases, the cards will have different markup depending on whether or not the minidoc document is in edit mode vs display mode. These two modes are distinguishable by checking `ctx.isEditable` in your render function.

For example, if you are using minidoc as the rich content editor for your blog, your blog post will render differently if you are editing it vs if your readers are viewing it.

The following card is an exmaple of an image card that renders an input for the image caption, if in edit mode, but renders a figcaption if in display mode.

```js
// h is a helper function for quickly building DOM elements.
import { h } from 'minidoc';

const imgCard = {
  type: 'img',

  initialState: { src: '', caption: '' },

  render(ctx) {
    const img = h('img', { src: ctx.state.src, alt: ctx.state.caption });

    // If we're not editable, we'll return a read-only DOM tree
    if (!ctx.isEditable) {
      return h('figure', img, ctx.state.caption && h('figcaption', ctx.state.caption));
    }

    const txtCaption = h('input', {
      type: 'text',
      value: ctx.state.caption,
      // We could update our state on each input, or onchange, too
      onblur: (e) => ctx.setState((s) => ({ ...s, caption: e.target.value })),
    });

    // When our state changes, we'll reflect that in the UI
    ctx.onStateChange = (state) => {
      if (img.src !== state.src) {
        img.src = state.src;
      }
      if (txtCaption.value !== state.caption) {
        txtCaption.value = state.caption;
      }
      img.alt = state.caption;
    };

    return h('figure', img, txtCaption);
  },
};
```

## Storage

Storage is out of scope for the minidoc library, but it's worth thinking about it to ensure minidoc doesn't cause undue storage headaches.

When saving a minidoc, you'll probably store the result in a database like Postgres, though you could just store it as JSON in s3 or on an SSD somewhere. At any rate, it's worth considering how a minidoc might be efficiently stored and loaded from a relational database.

Let's say we have a minidoc with several image cards. Those image cards can be modified in the editor, but they also might be modified by a background process, such as an image optimizer. Let's say that our workflow is as follows:

- A user adds an image to her document
- We save the image to a `files` table
- A background worker optimizes (and maybe converts the mime-type of) the image
- The background worker then updates the `files` row with the new url and mime type
- We also keep the original url around so we can link to it.

The card looks similar to our previous img card, but in this scenario, the state may be a little more complex:

```js
{
  id: 42,
  src: '/foo/bar/baz.jpg',
  mime: 'image/jpeg',
  original: '/foo/bar/baz.png',
  caption: 'A foo or a bar, who can tell?',
}
```

Our card's render will include a link to the original that opens in a new target window.

Anyway, when we save our document, it might look something like this:

```js
{
  doc: `
    <h1>Welcome to minidoc</h1>
    <p>A very basic editor</p>
    <mini-card />
    <p>That ^^^ is the first card</p>
    <mini-card />
    <p>And that is another...</p>
  `,
  cards: [
    {
      type: 'img',
      state: {
        id: 42,
        src: '/foo/bar/baz.jpg',
        mime: 'image/jpeg',
        original: '/foo/bar/baz.png',
        caption: 'A foo or a bar, who can tell?',
      },
    },
    {
      type: 'img',
      state: {
        id: 43,
        src: '/foo/bar/bing.png',
        mime: 'image/png',
        caption: 'What is Bing? Let me Google that.',
      },
    },
  ],
}
```

In this example, we have two cards. One with id 42 in its state, but another, newly added card with id 43. When the user adds an image, our card uploads it to Wasabi or Backblaze or, if you're a glutton for punishment, s3, notifies the back-end, and receives the row id back (43), and updates its state accordingly.

So now, we've got two image cards, but one of them is processing in a background worker in our service layer. The database record is overwritten before we save our document.

So now, on the server, we have a record that looks like this:

```js
{
  id: 43,
  src: '/foo/bar/bing.jpg',
  mime: 'image/jpeg',
  original: '/foo/bar/bing.png',
  caption: 'What is Bing? Let me Google that.',
}
```

When we save our document, a naive approach would simply overwrite the back-end records. However, what we really should do is track what properties have actually changed, and update only those.

So, it makes sense for minidoc applications to track their saved state and do an intelligent diff / update when saving to (mostly) avoid race conditions.

When loading a minidoc, the server needs to load up all relevant card state.

This could be done via normalization. A rough, probably really bad approximation:

```sql
-- images:        id, src, mime, original, caption, updated_at, created_at
-- counters:      id, value, updated_at, created_at
-- docs:          id, doc, updated_at, created_at
-- doc_images:    doc_id, image_id
-- doc_counters:  doc_id, counter_id
-- doc_card_order:  doc_id, card_type, card_id, order
```

On the other hand, card order seems like a pretty reasonable case for Postgres arrays...

```sql
-- docs: id, doc, cards, updated_at, created_at
```

It might still make sense to have join tables, though, for referential integrity, ease of querying, etc.

```js
// This is a relatively efficient approach which would work well for databses like SQLServer that
// support multiple parallel queries as a single request, but will work reasonably well for Postgres, etc.
function loadDoc(id) {
  const [doc, imageArr, counterArr] = await db.all([
    'SELECT id, doc, cards FROM docs WHERE id=@id',
    'SELECT i.id, i.src, i.mime, i.original, i.caption FROM images i INNER JOIN doc_images d ON d.image_id=i.id WHERE d.doc_id=@id',
    'SELECT c.id, c.value FROM counters c INNER JOIN doc_counters d ON d.card_id=c.id WHERE d.doc_id=@id',
  ], { id });
  const cards = {
    img: indexById(imageArr),
    counter: indexById(counterArr),
  };
  return {
    doc: doc.doc,
    cards: doc.cards.map(({ type, id }) => ({ type, state: cards[type][id] })),
  };
}
```

The result is fairly cache-friendly, too, so caching / loading documents in Redis or similar could be a reasonable optimization.

An alternative that requires two round trips, but avoids the need for join tables is to select cards based on the cards array in the docs table:

```js
function loadDoc(id) {
  const doc = await db.one('SELECT id, doc, cards FROM docs WHERE id=@id', { id });
  const [imageArr, counterArr] = await db.all([
    'SELECT id, src, mime, original, caption FROM images WHERE id IN @imageIds',
    'SELECT id, value FROM counters WHERE id IN @counterIds',
  ], {
    imageIds: doc.cards.filter((c) => c.type === 'img').map((c) => c.id),
    counterIds: doc.cards.filter((c) => c.type === 'counter').map((c) => c.id),
  });
  const cards = {
    img: indexById(imageArr),
    counter: indexById(counterArr),
  };
  return {
    doc: doc.doc,
    cards: doc.cards.map(({ type, id }) => ({ type, state: cards[type][id] })),
  };
}
```

An alternative would be to store the cards as JSON in a cards table. Postgres has relatively good atomic JSON operations, so background workers could update images, etc. It's hacky, but let's consider it:

```sql
-- cards: id, doc_id, type, state, updated_at, created_at
-- docs:  id, doc, cards, updated_at, created_at
```

In this world, we won't ever share a card between docs, which is honestly probably the correct decision.

```js
function loadDoc(id) {
  const [doc, cardArr] = await db.all([
    'SELECT id, doc, cards FROM docs WHERE id=@id',
    'SELECT id, type, state FROM cards WHERE doc_id=@id',
  ], { id });
  const cards = indexById(cardArr);
  return {
    doc: doc.doc,
    cards: doc.cards.map((id) => cards[id]),
  };
}
```

Let's consider something like a card that contains a survey. Its state might look something like this:

```js
{
  questions: [
    {
      id: 1,
      text: 'What do you think?',
      choices: [{ id: 99, caption: 'No opinion' }, { id: 100: caption: 'Meh' }],
    },
    {
      id: 2,
      text: 'Should this really be relational?',
      choices: [{ id: 101: 'Yes' }, { id: 200: 'Definitely' }],
    },
  ],
}
```

If we stored that as JSON in a cards table, rather than as a relational set of tables, we might store answers like so:

```sql
survey_answers:   id, doc_id, user_id, question_id, choice_id, updated_at, created_at
```

So, with that, we can pretty quickly compute aggregates, etc on answers, but we still get the benefit of storing cards in a general table. 

Downsides are:

- Loss of any referential integrity between survey questions and answers
- Migration headaches if we make structural / system changes to the shape of a survey card's state

Database migrations are generally fairly trivial when the data is relational. Add a column, here's the default, here's the constraint. With JSON, you lose data integrity, referential integrity, and doing migrations like "rename this column" becomes hairy.

Also, if you are using minidoc in a multi-user scenario, where multiple users can edit the same document simultaneously, the JSON changes become even gnarlier. Then again, that scenario itself is already gnarly, so...

Anyway, I'd lean towards a normalized(ish) approach, simply because the flexibility of it is almost always useful over time, and the majority of times I've used unstructured storage, I've regretted it.

Anyway, this was a digression. The end result is that keeping card state as a standalone structure aids in the storage mechanism.


## Copying

When a user copies a card, that card's state is copied, and any changes to the copy have no impact on the original. This presents challenges when saving minidocs.

For example, let's say you had a media card with this state:

```js
{
  // The database id associated with the stored file
  id: 92,
  url: 'https://example.com/foo.png',
}
```

Copying that card would produce two cards with id 92.

When the user saves the minidoc, the application needs to identify the duplication and create a new record.
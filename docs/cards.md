# Cards

## Overview

Cards are the mechanism by which applications can extend minidocs to add their own custom content embedded within a minidoc. These may be video, surveys, stock tickers, etc. 

## Representation

Cards are a custom DOM element `mini-card` with a type and a state property. The state property is simply the card's state represented as a JSON string. The following is a hypothetical example:

```html
<mini-card
  type='media'
  state='{"type":"video/mp4","src":"/foo/bar.mp4","caption":"Swank","id":90}'
></mini-card>
```

## Edge-case: video transcoding

A card such as the media card example above might need to have its data updated by a background process. For example, the video might get transcoded, and the `state.type` might change from "video/mp4" to "application/x-mpegURL" or whatever.

Ideally, such an update would be a simple SQL statement (or whatever your data store is), and would not require loading, parsing, updating, and re-serializing a minidoc.

Such scenarios are beyond the scope of minidoc itself, but we'll consider them here to ensure the design of minidoc does not preclude them.

Probably what the application would wish to do in this scenario is to store the video in an append-only table, lets call it: `files`.

It might look like this:

```
id, url, type, size, created_at
```

And we might refer to it via an `attachments` table like so:

```
id, file_id, original_file_id, created_at, updated_at
```

So, a file embedded in a document will be an attachment and may point to both an original file and a current file.

OK. So, when the user drops a video file onto a minidoc, the application's media card will upload it, get the attachment id, the file type, url, etc, and update the media card state accordingly.

This state will be embedded in the document as JSON. When the transcoder completes, it will update the `attachments` record with the new info.

When the media card is loaded, the application will side-load the file info for any attachments in the doc, and the media card will refer to this data for anything it needs.

## Edge-case: surveys

Imagine you have a doucument, and you want to embed a survey in it.

It might be represented as follows:


```html
<mini-card
  type='survey'
  state='{"id":"abc","questions":[{"id":"q1","text":"What do you think?"}]}'
></mini-card>
```

When you publish this document, the "view" mode of the survey card will present the user with the survey, or if the user has already taken the survey, the user will see the survey results.

Once again, we have a problem. We probably want to store answers in a relational way. We also probably want to enforce rules about surveys. For instance, can users see the results, or can only the document author see results?

To do this, we'd want to store the survey as a distinct table.

Something roughly like this:

```
# surveys
id, title, public_results, created_at

# survey_questions
id, survey_id, text, created_at, updated_at

# survey_answers
id, q_id, u_id, value
```

The application will need to track survey info on its own, so that when the author saves her document, the application can save the survey state independently. The mini-card's state attribute may contain nothing more than the survey id.

Note: We may want to allow cards to distinguish between state that is in the undo / redo system and state that is persisted.

```js
// We may allow cards to specify getSaveState as well as using
// `onStateChange` to update the transient state.
opts.getSaveState = () => ({ id });
```

In this scenario, when the author performs an undo / redo operation, the questions may get added / removed / reordered, and the card should treat its initialState as authoritative, overriding the application state.

- When the document loads, get the survey state from the application, not from the minidoc.
- When an undo / redo occurs, treat the minidoc state as authoritative
- When a copy / cut / paste occurs, treat the minidoc state as authoritative (see below for the clipboard edge-case)

## Edge-case: clipboard

When the user pastes a complex card (say, a survey), the card needs to be intelligent about what it should do.

In the case of a survey, let's think through several edge-cases:

- User cuts / pastes within document A, creating a move
- User copies / pastes within document A, creating a copy
- User copies / pastes from document A to document B, creating a copy

Creating a duplicate within a document is something an application can detect by tracking its state like so:

```js
{
  surveys: {
    32: {
      title: 'Fanci survey',
      parentDoc: 99,
      refCount: 1,
      questions: [],
    },
  },
}
```

So, survey 32 belongs to the document with id 99, and is referenced once.

When the user pastes a copy of it, and refCount is 1, the card should create a new survey entry (e.g. with id 33 or whatever).

When the user pastes a survey with a different parentDoc, the card should create a copy.

This is a hassle. And, there are further complications with the use of external state. If the application allows copying of documents wholesale (e.g. when looking at a list of documents, click "create a copy"), then the application needs to be smart enough to create copies of all related data (e.g surveys) *and* it needs to update the document's references to have the new ids.

This seems needlessly complex.

## Alternative

Let's revisit the survey in light of the copying conundrum.

What if instead of external data, the application treats the document as authoritative. So, you can create N copies of a document, and each survey, etc is treated independently.

In this scenario, how might one go about tracking data such as survey answers?

```
# survey_answers
id, doc_id, q_id, u_id, value
```

Here, the survey card would be responsible for generating unique question ids. A cut / paste would work. A copy / paste to another document, or a duplication of a document would work. The only thing that is still tricky is the copy / paste of a survey that produces a duplicate within the same document-- when a survey is pasted, the card needs to scan the document for the existence of any questions with the same ids as those in the survey, and if it finds dups, it should generate new ids for its own questions.

### Drawbacks

If the application wishes to give visibility into surveys outside of a document (e.g. maybe there is a "surveys" screen that shows *only* surveys), this would not be possible if the embedded data was the source of truth.

Also, if the application ever needed to make significant changes to how surveys were structured, the app would either have to create a brand new card, or keep backwards-compatibility forever, or migrate all documents. If instead the survey data was kept in a table, and side-loaded, migrations would be fairly trivial.

## Conclusion

There are pitfalls to any approach to complex cards. I think that I would lean towards having the document be the sole source of truth. But in the case where an external source of truth is desired, workarounds should not be *too* hard.

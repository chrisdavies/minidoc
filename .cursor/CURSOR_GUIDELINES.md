# Cursor Guidelines

## Interaction

Always ask for clarification if something I say isn't clear.

Wait for me to indicate that I want you to make changes before doing anything.

## Testing

We don't test heavily.

Important happy-paths should be tested, as should anything that is easily unit tested.

## Dependencies

Always prefer fewer dependencies.

Use specific versions when installing a package (e.g. `"1.2.3"` not `"^1.2.3"`).

If something can be trivially accomplished using the Node SDK on the server, or the browser APIs on the client, then never suggest a package for it.

- If a home-rolled implementation can be done in 1K lines of clear code or fewer, always home-roll
- If a home-rolled solution would take 1K+ lines, we can discuss a package 

Always prompt before pulling in a new npm package.

If you think a package is necessary, it would be good to give a justification:

- How many lines of code would it take to accomplish the same thing without a new dependency?
- What alternatives are there, and why is this the best?

If we *do* pull in a package, I prefer packages that have 0 dependencies.

## Comments

Comments should follow these styles:

```js
// Single line comments are fine

/**
 * Doc comments are always like this.
 */

/** Never like this */
```

## Misc

- Prefer shallowly nested code
- Use early returns to avoid nesting

## One-liners

Always use brackets with expressions (while, for, if, etc).

```js
// NO
if (foo) return false;

// YES
if (foo) {
  return false;
}
```

## Mutation

Generally, we don't mutate code.

If mutation is *far* more obvious and simple compared to an immutable approach, feel free to mutate.

If you're uncertain, ask.

### Let vs const

In general, don't use `let` use `const`.

```js
// NO
let hello = 'bob';
if (foo) {
  hello = 'jane';
}

// YES
const hello = foo ? 'jane' : 'bob';
```

### Module-level values

Values at the module level should *almost* always be consts, not lets.

There shouldn't be module-level values if a function could do the trick.

```js
// No
let foo = 'hello';

function sayHi(name) {
  foo = `hello ${name}`;
}
```

```js
// Yes
function sayHi(name) {
  return `hello ${name}`;
}
```

### Local mutation is fine as an optimization

Sometimes it's clearer (and always more efficient) to do local mutation.

Local mutation is fine if it's done within a few short lines of code.

The further away from the declaration that the mutation happens, the more we should prefer an immutable approach.

```js
// No
function index(items, into) {
  return items.reduce((acc, x) => {
    // This mutates acc, but acc is actually the same value as into
    // which was passed in, so this mutation is visible outside of
    // our index function. Don't ever do this.
    acc[x.id] = x;
    return acc;
  }, into);
}

// Yes
function index(items, into) {
  return items.reduce((acc, x) => {
    // This mutates acc, but it's fine, since acc is a *copy*
    // of index, and these mutations are 100% local to this
    // index function.
    acc[x.id] = x;
    return acc;
  }, {...into});
}
```

### Misc mutations

```js
// Simple loop variables are fine to mutate
function loopDemo() {
  for (let i = 0; i < 10; ++i) {
    console.log(i);
  }
}

// Counters are fine to mutate, and in situations
// like this, it's fine to reuse the parameter and
// change it in the loop, since the change is not
// visible outside of the function, and the function
// is small, and the original value is never needed
// again.
function countAncestors(node) {
  let count = 0;
  while (node)
    node = node.parentElement;
    ++count;
  }
  return count;
}
```

## Simple functional style

We prefer a functional style.

Simple functional code is fine.

Complex functional code is not.

Avoid point-free style and monads.

Use async / await rather than chaining promises.

Prefer spread operators to mutation except as a local optimization.

### Avoid point-free code and currying.

```js
// NO
const getMemberName = pipe(
  makeQuery,
  fetchMember,
  andThen(props(['firstName', 'lastName'])),
  andThen(join(' ')),
);

getMemberName('bob@gmail.com').then(console.log);

// YES
async function getMemberName(email) {
  const member = await fetch(`/members?email=${encodeURIComponent(email)}`);
  const { firstName, lastName } = member;
  return `${firstName} ${lastName}`;
}

getMemberName('bob@gmail.com').then(console.log);
```

### Prefer functions to methods

This example is for illustration only. In a scenario this simple, I wouldn't have an `onNameChange` function at all, but just do the spread wherever necessary.

```js
// NO
function onNameChange(user, name) {
  user.setName(name);
}

// YES
function onNameChange(user, name) {
  return { ...user, name };
}
```

## Error handling

Errors should not be used for control flow.

That said, if a *library* throws an error and we can do something useful with it, then we should.

In all other cases, errors should generally be handled at the boundaries.

Our `rpx` endpoints have error handling built in, so we almost never need to explicitly handle errors.

Our front-end pages also tend to have loading errors built in.

If we do need to write a catch on the front end, it should usually be paired with a `showError` call.

## Type safety

Prefer accurate static types where possible.

When the type system makes you jump through too many hoops, it's OK to fallback to `any`, but this is similar to mutation where the `any` cast is ideally local.

Here's an example:

```jsx
<input onInput={(e: any) => setName(e.target.value)} />
```

This any cast doesn't affect other modules, except maybe the `setName`, but it's relatively safe and obvious.

### Types vs interfaces

Generally, we prefer types. Our codebase *used* to prefer interfaces, so you'll see a lot of that, but new code should prefer types.

```ts
// NO
interface Foo {
  name: string;
}

// YES
type Foo = {
  name: string;
};
```

## Classes

In general, we avoid using `class` and inheritance, instead preferring functions and simple data structures which those functions operate on.


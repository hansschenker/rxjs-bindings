# rxjs-bindings

Lifecycle-aware reactive bindings for TypeScript and RxJS.

> Bind a subscribable to a consumer. Keep subscription lifecycle management
> separate from application logic.

**Status:** Initial implementation proposal for RxJS 7.8 and TypeScript 5.
Not published to npm. Build and tests require dependency installation and
verification. No license has yet been selected.

## Motivation

Angular's AsyncPipe binds an Observable to a view and manages its
subscription lifecycle. This project generalizes the idea into small,
composable functions without Angular or any other framework. Core bindings
work with browser and server-side TypeScript; DOM bindings are separate.

## API

| Function | Responsibility | Import |
| --- | --- | --- |
| `bindSubscribable(source, consume, destroy$)` | Forward values to a callback. | Core |
| `bindObserver(source, observer, destroy$)` | Forward next, error and complete notifications. | Core |
| `bindProperty(source, target, key, destroy$)` | Assign to a writable property. | Core |
| `bindText(source, element, destroy$)` | Update DOM text safely. | DOM |
| `bindAttribute(source, element, name, destroy$)` | Set or remove an attribute. | DOM |
| `bindStyle(source, element, property, destroy$)` | Set or remove a CSS property. | DOM |
| `bindClass(source, element, className, destroy$)` | Toggle one CSS class. | DOM |
| `bindEvent(target, name, consume, destroy$, options?)` | Attach a native event listener. | DOM |
| `bindState(source, state, destroy$)` | Forward state snapshots to a state sink. | Core |
| `createBindingScope()` | Create a shared, terminal lifecycle signal. | Core |

Each binding returns an RxJS `Subscription`. Core sources implement
`Subscribable<T>`, including ordinary RxJS Observables and Subjects.
Core imports come from `rxjs-bindings`; DOM imports from `rxjs-bindings/dom`.

## Install and run locally

```sh
npm install
npm run build
npm test
npm run check:examples
npm run example:node
```

Use Node.js 20 or newer for the provided tests. The package is private until
the maintainer decides whether to publish it. The import specifiers below
refer to the eventual local/built package, not an existing npm publication.

## Shared lifecycle

```ts
import { BehaviorSubject, interval, of, Subject, scan, map } from 'rxjs';
import {
  bindSubscribable, bindObserver, bindProperty, bindState,
  createBindingScope
} from 'rxjs-bindings';

const scope = createBindingScope();
const { destroy$ } = scope;
```

All nine examples below are one-way bindings.

### 1. bindSubscribable — callback binding

```ts
const counter$ = interval(1000);
const subscription = bindSubscribable(
  counter$,
  count => console.log(count),
  destroy$
);

// Optional: cancel just this binding.
subscription.unsubscribe();
```

### 2. bindObserver — full notification handling

```ts
bindObserver(of('ready'), {
  next: value => console.log(value),
  error: error => console.error(error),
  complete: () => console.log('finished')
}, destroy$);
```

### 3. bindProperty — object property binding

```ts
const model = { temperature: 0 };
const temperature$ = new BehaviorSubject(21);

bindProperty(temperature$, model, 'temperature', destroy$);
temperature$.next(23);

console.log(model.temperature); // 23
```

### 4. bindText — DOM text

The following DOM examples run in a browser. They share the scope above.

```ts
import {
  bindText, bindAttribute, bindStyle, bindClass, bindEvent
} from 'rxjs-bindings/dom';

const status = document.createElement('span');
const name$ = new BehaviorSubject('RxJS');

bindText(name$, status, destroy$);
document.body.append(status);
name$.next('Reactive bindings');
```

Values are written via `textContent`, not `innerHTML`. Null or undefined
clears the text.

### 5. bindAttribute — DOM attribute

```ts
const link = document.createElement('a');
const url$ = new BehaviorSubject<string | null>('https://rxjs.dev');

bindAttribute(url$, link, 'href', destroy$);
link.textContent = 'RxJS';
document.body.append(link);

url$.next(null); // Removes href.
```

Null and undefined remove the attribute. For boolean HTML attributes,
use an empty string for presence and null for absence. This adapter does
not sanitize attribute names or URLs: use trusted/validated values and
do not bind untrusted input to executable attributes or unsafe URLs.

### 6. bindStyle — CSS property

```ts
const progress = document.createElement('div');
const progress$ = new BehaviorSubject(25);

bindStyle(
  progress$.pipe(map(value => `${value}%`)),
  progress,
  'width',
  destroy$
);
progress.style.height = '8px';
progress.style.backgroundColor = 'royalblue';
document.body.append(progress);

progress$.next(75); // width: 75%
```

Use CSS property names such as `background-color` or `--progress`. Null or
undefined removes the property; numeric units must be supplied by the caller.

### 7. bindClass — conditional class

```ts
const active$ = new BehaviorSubject(false);

bindClass(active$, status, 'active', destroy$);
active$.next(true);  // Adds active.
active$.next(false); // Removes active.
```

### 8. bindEvent — lifecycle-bound event listener

```ts
const button = document.createElement('button');
button.textContent = 'Refresh';
document.body.append(button);

bindEvent(button, 'click', event => {
  console.log('Refresh:', event.type);
}, destroy$);
```

Uses RxJS `fromEvent` internally. Destruction removes the event listener.
The event callback receives an `Event`; narrow it if you need specific
event properties.

### 9. bindState — state sink

```ts
const increment$ = new Subject<number>();
const total$ = increment$.pipe(
  scan((total, delta) => total + delta, 0)
);

const store = {
  state: 0,
  setState(value: number) {
    this.state = value;
  }
};

bindState(total$, store, destroy$);
increment$.next(2);
increment$.next(3);

console.log(store.state); // 5
```

A state sink needs a `setState(value)` method. The binding forwards snapshots;
merge or replacement semantics belong to the sink.

## Dispose a scope

```ts
scope.destroy();
```

All bindings using the scope stop receiving notifications and release their
upstream subscriptions. This does not undo property, DOM or state changes.
A `ReplaySubject<void>(1)` backs the terminal lifecycle signal so bindings
created after destruction do not even start their sources.

Destroying a scope completes its active bindings through `takeUntil`.
Manual `subscription.unsubscribe()` instead cancels an individual binding
without delivering completion. Completing a destroy notifier without an
emission is not sufficient to trigger `takeUntil`.

## Architecture

```text
Subscribable<T> ──► bindSubscribable ──► Consumer<T>
                          ▲
                          │
                      destroy$
```

`bindObserver` is the common subscription mechanism; `bindSubscribable`
provides the callback-oriented facade. Specialized adapters delegate to it.

```ts
import { Observable, takeUntil } from 'rxjs';
import type { Subscribable, Subscription } from 'rxjs';

function bindSubscribable<T>(
  source: Subscribable<T>,
  consume: (value: T) => void,
  destroy$: Observable<unknown>
): Subscription {
  const source$ = source instanceof Observable
    ? source
    : new Observable<T>(subscriber => source.subscribe(subscriber));

  return source$.pipe(takeUntil(destroy$)).subscribe(consume);
}
```

The actual implementation delegates to `bindObserver` to avoid duplication.
A plain `Subscribable<T>` is not necessarily an `ObservableInput`, so simply
calling `from(source)` is insufficient for the general interface.

### Consumer vs. producer lifecycle

| Concern | Mechanism |
| --- | --- |
| Consumer lifecycle | `bindSubscribable`, `takeUntil`, `unsubscribe` |
| Shared ongoing producer lifecycle | `share` or `shareReplay({ bufferSize: 1, refCount: true })` |
| Dynamic source replacement | `switchMap` (future binding extension) |

Reference counting does not replace consumer teardown. Bindings do not
implicitly multicast or cache sources. If multiple bindings should share a
producer, explicitly share it upstream. Actual cancellation depends on
the source's teardown implementation.

### Automatic lifecycle using native Web Components

See [examples/browser.ts](examples/browser.ts) and
[examples/browser.html](examples/browser.html). `connectedCallback`
creates a scope; `disconnectedCallback` destroys it. Reconnecting creates
a fresh scope.

To run the browser example using an optional TypeScript bundler/dev server:

```sh
npm install
npx vite --open /examples/browser.html
```

## Design principles

- Pure RxJS and TypeScript, with no frontend framework dependency.
- Separate DOM adapters from framework-independent core.
- Handle synchronous and asynchronous emissions.
- Make ownership and disposal explicit; no hidden subscriptions.
- Prefer one-way bindings and small composable functions.
- Do not silently swallow source errors. Use `bindObserver` to handle errors
  and completion explicitly, or recover within the source pipeline.

## Implementation roadmap

- [x] Draft core and DOM binding implementations.
- [x] Include usage examples for every binding.
- [x] Write lifecycle and adapter tests.
- [ ] Install dependencies, build and run tests in a real RxJS environment.
- [ ] Validate DOM adapters in a browser.
- [ ] Evaluate `bindValue`, `bindEnabled`, `bindVisible`, dynamic source
  replacement and explicit two-way binding semantics.
- [ ] Set up CI, select a license and decide on npm publication.

## Inspiration and contributors

This idea originated in a discussion about Ben Lesh's talk
[Complex Features Made Easy With RxJS](https://www.youtube.com/watch?v=E3Eego8xKdk&t=665s),
particularly its discussion of Angular's AsyncPipe and subscription management.

- **[@hansschenker](https://github.com/hansschenker)** — project initiator;
  proposed `bindSubscribable` as a generalization of `bindAsync`.
- **GlaspGPT (ChatGPT, OpenAI)** — AI-assisted design collaborator;
  proposed the foundational `bindAsync` idea and family of `bind...`
  functions; assisted with API design, code, documentation and test drafts.

See [CONTRIBUTORS.md](CONTRIBUTORS.md). This project is not affiliated
with Angular, RxJS, Ben Lesh or OpenAI.

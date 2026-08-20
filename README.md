# rxjs-bindings

Minimal DOM data binding with **RxJS 7** and **no web framework**.

The project explores a deliberately small UI architecture:

```text
DOM event
   │
   ▼
fromEvent()
   │
   ▼
Observable<Action>
   │
   ▼
scan(reduceState, initialState)
   │
   ▼
Observable<State>
   │
   ├──► bindText()
   └──► bindProperty()
            │
            ▼
           DOM
```

## Core idea

There are two different directions at the DOM boundary:

```text
DOM → RxJS     fromEvent(...)
RxJS → DOM     bindText(...), bindProperty(...)
```

`fromEvent()` remains visible because it already expresses the source side precisely. A `bindEvent()` wrapper would merely rename the RxJS mechanism without adding useful semantics.

The binding layer therefore contains only two sink functions:

```ts
bindText(element, value$)
bindProperty(element, property, value$)
```

Both return the underlying `Subscription`, keeping lifecycle and cancellation explicit.

## Angular binding correspondence

| Angular | RxJS-only equivalent |
| --- | --- |
| `{{ value }}` | `bindText(element, value$)` |
| `[value]="value"` | `bindProperty(element, 'value', value$)` |
| `(click)="..."` | `fromEvent(element, 'click')` |
| `[(ngModel)]="value"` | `fromEvent(...)` + `bindProperty(...)` |

Two-way binding is therefore not a primitive. It is two one-way dataflows:

```text
DOM ──fromEvent()────────────► RxJS
DOM ◄─bindProperty()────────── RxJS
```

## Architecture

### 1. Enter the RxJS world

DOM events become Observables using standard RxJS sources.

```ts
const increment$ = fromEvent(button, 'click').pipe(
  map(() => ({ type: 'increment' } as const)),
);
```

### 2. Stay in the RxJS world

Actions are merged and reduced into state.

```ts
const state$ = action$.pipe(
  scan(reduceState, initialState),
  startWith(initialState),
  shareReplay({ bufferSize: 1, refCount: true }),
);
```

Domain behavior stays in plain functions such as `reduceState`. RxJS operators remain visible as the stream plumbing.

### 3. Exit the RxJS world

Projected state streams are connected to DOM sinks.

```ts
const count$ = state$.pipe(
  map(state => state.count),
  distinctUntilChanged(),
);

bindText(countElement, count$);
```

No change-detection loop is required. A DOM binding receives a value only when its stream emits.

## API

### `bindText`

```ts
const bindText = (
  element: Element,
  value$: Observable<unknown>,
): Subscription
```

Subscribes to `value$` and assigns each emitted value to `element.textContent`.

### `bindProperty`

```ts
const bindProperty = <
  E extends HTMLElement,
  K extends keyof E,
>(
  element: E,
  property: K,
  value$: Observable<E[K]>,
): Subscription
```

Subscribes to `value$` and assigns each emitted value to the selected DOM property. The property name and Observable value type stay linked by TypeScript.

## Run the example

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
```

## Design principles

- RxJS 7 is the baseline.
- DOM events are sources; DOM properties and text are sinks.
- Do not hide standard RxJS operators or sources behind domain-flavored aliases.
- Business logic lives in plain functions passed to RxJS operators.
- State is a stream that remembers: `scan(...)` + `shareReplay(1)`.
- Sharing is explicit.
- Subscription ownership and teardown are explicit.
- Two-way binding is modeled as two one-way dataflows.
- No framework and no change-detection mechanism are required.

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
   ├──► bindProperty()
   ├──► bindAttribute()
   ├──► bindClass()
   └──► bindStyle()
            │
            ▼
           DOM
```

## Core idea

There are two different directions at the DOM boundary:

```text
DOM → RxJS     fromEvent(...)

RxJS → DOM     bindText(...)
               bindProperty(...)
               bindAttribute(...)
               bindClass(...)
               bindStyle(...)
```

`fromEvent()` remains visible because it already expresses the source side precisely. A `bindEvent()` wrapper would merely rename the RxJS mechanism without adding useful semantics.

The binding layer therefore contains only **DOM sink functions**. Each function returns the underlying `Subscription`, keeping lifecycle and cancellation explicit.

## Angular binding correspondence

| Angular | RxJS-only equivalent |
| --- | --- |
| `{{ value }}` | `bindText(element, value$)` |
| `[value]="value"` | `bindProperty(element, 'value', value$)` |
| `[attr.aria-label]="label"` | `bindAttribute(element, 'aria-label', label$)` |
| `[class.active]="active"` | `bindClass(element, 'active', active$)` |
| `[style.width]="width"` | `bindStyle(element, 'width', width$)` |
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

Assigns each emitted value to `element.textContent`. `null` and `undefined` become an empty string.

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

Assigns each emitted value to the selected DOM property. The property name and Observable value type stay linked by TypeScript.

### `bindAttribute`

```ts
const bindAttribute = (
  element: Element,
  attribute: string,
  value$: Observable<string | number | boolean | null | undefined>,
): Subscription
```

Sets one DOM attribute. `null` and `undefined` remove the attribute; every other value is stringified.

```ts
bindAttribute(element, 'aria-label', label$);
```

### `bindClass`

```ts
const bindClass = (
  element: Element,
  className: string,
  enabled$: Observable<boolean>,
): Subscription
```

Toggles one class token. `true` adds the class and `false` removes it.

```ts
bindClass(element, 'active', active$);
```

### `bindStyle`

```ts
const bindStyle = (
  element: HTMLElement,
  property: string,
  value$: Observable<string | number | null | undefined>,
): Subscription
```

Sets one inline CSS property. `null` and `undefined` remove it. The binding does not invent units: the upstream stream decides whether the value is `"12px"`, `"50%"`, `0.5`, and so on.

```ts
const width$ = count$.pipe(
  map(count => `${count * 10}%`),
);

bindStyle(element, 'width', width$);
```

## Primitive DOM sink family

The current binding primitives are:

```text
Observable<Value>
       │
       ├──► bindText()       ──► textContent
       ├──► bindProperty()   ──► DOM property
       ├──► bindAttribute()  ──► attribute
       ├──► bindClass()      ──► class token
       └──► bindStyle()      ──► inline CSS property
```

These functions do not transform application data. They only connect already-computed values to imperative DOM effects.

## Run the example

```bash
npm install
npm run dev
```

Type-check:

```bash
npm run typecheck
```

Production build:

```bash
npm run build
```

## Design principles

- RxJS 7 is the baseline.
- DOM events are sources; text, properties, attributes, classes, and styles are sinks.
- Do not hide standard RxJS operators or sources behind domain-flavored aliases.
- Business logic lives in plain functions passed to RxJS operators.
- State is a stream that remembers: `scan(...)` + `shareReplay(1)`.
- Sharing is explicit.
- Subscription ownership and teardown are explicit.
- Two-way binding is modeled as two one-way dataflows.
- DOM sinks apply values; upstream streams decide what those values mean.
- No framework and no change-detection mechanism are required.

## Roadmap

Next architectural steps:

1. `bindIf()` — reactive DOM lifetime / conditional mounting.
2. Reactive form controls — values, validation, dirty/touched state, and effects as streams.

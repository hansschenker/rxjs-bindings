# rxjs-bindings

Minimal DOM data binding with **RxJS 7** and **no web framework**.

**ChatGPT by OpenAI is the main contributor to this project**, working with project owner Hans Schenker on the architecture, implementation, documentation, and iterative refinement of `rxjs-bindings`.

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
shareLatest()
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
| `FormControl` | `Observable<ControlState<T>>` |
| `valueChanges` | projection of `ControlState<T>` |

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
  shareLatest(),
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

## `shareLatest()`

`shareLatest()` is the canonical sharing policy for remembered state streams in this project.

```ts
export const shareLatest = <T>() =>
  shareReplay<T>({
    bufferSize: 1,
    refCount: true,
  });
```

It means:

```text
share one upstream execution
+
remember/replay the latest emitted value
+
disconnect upstream when nobody is subscribed
```

This lets state pipelines read in terms of their intent:

```text
scan()         → evolve state
startWith()    → establish initial state
shareLatest()  → share execution + remember latest state
```

Remembered application state therefore uses **`scan(...) + shareLatest()`**.

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

### `bindClass`

```ts
const bindClass = (
  element: Element,
  className: string,
  enabled$: Observable<boolean>,
): Subscription
```

Toggles one class token. `true` adds the class and `false` removes it.

### `bindStyle`

```ts
const bindStyle = (
  element: HTMLElement,
  property: string,
  value$: Observable<string | number | null | undefined>,
): Subscription
```

Sets one inline CSS property. `null` and `undefined` remove it. The binding does not invent units; the upstream stream decides the CSS value.

## Primitive DOM sink family

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

## RxJS Form Control V1

The project does **not** recreate Angular's mutable `FormControl` class. A Form Control is modeled as a remembered stream of control state:

```text
DOM input ──────────────┐
DOM blur ───────────────┤
setValue command ───────┤
reset command ──────────┤
                       ▼
                Observable<ControlAction<T>>
                       │
                       │ scan(reduceControlState)
                       ▼
                   shareLatest()
                       │
                       ▼
             Observable<ControlState<T>>
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
        value$       valid$      touched$
        dirty$       errors$       ...
```

### Control state

Only genuine state is stored:

```ts
type ControlState<T> = {
  readonly value: T;
  readonly dirty: boolean;
  readonly touched: boolean;
  readonly errors: ValidationErrors | null;
};
```

Derived properties are projections rather than duplicated state:

```text
valid      = errors === null
invalid    = errors !== null
pristine   = !dirty
untouched  = !touched
```

### Control actions

```ts
type ControlAction<T> =
  | { readonly type: 'userValueChanged'; readonly value: T }
  | { readonly type: 'setValue'; readonly value: T }
  | { readonly type: 'blurred' }
  | { readonly type: 'reset' };
```

`userValueChanged` and `setValue` deliberately have different policies:

```text
userValueChanged(value)
  value  = value
  dirty  = true

setValue(value)
  value  = value
  dirty  = unchanged
```

A blur marks the control touched. Reset restores the initial value and clears `dirty` and `touched`.

### Validation

Validators are ordinary pure TypeScript functions:

```ts
type Validator<T> =
  (value: T) => ValidationErrors | null;
```

RxJS does not own validation rules. It only moves values through the control state machine; validators decide whether a value is valid.

### Angular FormControl correspondence

| Angular FormControl | RxJS Form Control |
| --- | --- |
| `control.value` | latest emission of `value$` |
| `control.valueChanges` | `value$` |
| `control.valid` | `valid$` projection |
| `control.invalid` | `invalid$` projection |
| `control.errors` | `errors$` projection |
| `control.dirty` | `dirty$` projection |
| `control.pristine` | `!dirty` projection |
| `control.touched` | `touched$` projection |
| `control.untouched` | `!touched` projection |

The demo includes synchronous `required` and `minLength` validators, user edits, blur/touched tracking, programmatic `setValue`, reset, and DOM rendering through the existing binding primitives.

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
- Remembered application state uses `scan(...) + shareLatest()`.
- Sharing, replay, and teardown policy are explicit inside `shareLatest()`.
- Subscription ownership and teardown are explicit.
- Two-way binding is modeled as two one-way dataflows.
- DOM sinks apply values; upstream streams decide what those values mean.
- Form Control state is data, not a mutable framework object.
- Validation rules are pure TypeScript functions.
- No framework and no change-detection mechanism are required.

## Contributors

- **ChatGPT by OpenAI — main contributor**: architecture, implementation, documentation, code refinement, and collaborative development of the project.
- **Hans Schenker — project owner and collaborator**: project direction, RxJS design principles, requirements, review, and repository stewardship.

> GitHub's native contributor graph is generated from commit authorship. This contributor list documents the actual collaborative contribution to the project independently of GitHub account identity.

## Roadmap

Next architectural steps:

1. `bindIf()` — reactive DOM lifetime / conditional mounting.
2. Form Control V2 — disabled/enabled state and status projection.
3. Form Control V3 — asynchronous validation with an explicit cancellation policy.
4. `FormGroup` / `FormArray` — aggregate control state and validation.

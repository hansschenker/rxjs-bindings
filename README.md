# rxjs-bindings

Minimal DOM data binding and application dataflow with **RxJS 7**, **TypeScript**, and **no web framework**.

**ChatGPT by OpenAI is the main contributor to this project**, working with project owner Hans Schenker on the architecture, implementation, documentation, and iterative refinement of `rxjs-bindings`.

The project explores how far standard RxJS plus a very small DOM boundary can replace framework machinery while keeping time, cancellation, sharing, state, and effects explicit.

```text
DOM / browser sources
        │
        ▼
     fromEvent()
        │
        ▼
 Observable<Action>
        │
        ▼
 operators + pure TypeScript functions
        │
        ▼
 remembered state / effect state
        │
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

## Angular correspondence

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
| `HttpClient` request state | `Observable<LoadingState<T>>` |

Two-way binding is not a primitive. It is two one-way dataflows:

```text
DOM ──fromEvent()────────────► RxJS
DOM ◄─bindProperty()────────── RxJS
```

## Architecture

### 1. Enter the RxJS world

DOM and browser events become Observable sources using standard RxJS:

```ts
const increment$ = fromEvent(button, 'click').pipe(
  map(() => ({ type: 'increment' } as const)),
);
```

### 2. Stay in the RxJS world

Actions, state, effects, and request lifecycles are expressed as dataflow:

```ts
const state$ = action$.pipe(
  scan(reduceState, initialState),
  startWith(initialState),
  shareLatest(),
);
```

Domain behavior stays in plain TypeScript functions. RxJS operators remain visible as the stream plumbing and temporal policy.

### 3. Exit the RxJS world

Projected streams are connected to imperative DOM sinks:

```ts
const count$ = state$.pipe(
  map(state => state.count),
  distinctUntilChanged(),
);

bindText(countElement, count$);
```

No change-detection loop is required. A DOM binding receives a value only when its stream emits.

## `shareLatest()`

`shareLatest()` is the canonical sharing policy for remembered state and effect-state streams in this project.

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

This lets pipelines read in terms of intent:

```text
scan()         → evolve state
startWith()    → establish initial state
shareLatest()  → share execution + remember latest state
```

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
```

Only genuine state is stored:

```ts
type ControlState<T> = {
  readonly value: T;
  readonly dirty: boolean;
  readonly touched: boolean;
  readonly errors: ValidationErrors | null;
};
```

Derived values such as `valid`, `invalid`, `pristine`, and `untouched` are projections.

Validators are ordinary pure TypeScript functions:

```ts
type Validator<T> =
  (value: T) => ValidationErrors | null;
```

RxJS moves values through the control state machine; validators own the validation rules.

## RxJS HTTP LoadingState V1

HTTP is modeled as a temporal state transition rather than as a future response value:

```text
RequestIntent$
      │
      │ switchMap
      ▼
    HTTP$
      │
      ├── start ───────► Loading
      ├── response ────► Success(value)
      └── error ───────► Error(error)
                           │
                           ▼
                    LoadingState<T>$
                           │
                      shareLatest()
                           │
             ┌─────────────┼─────────────┐
             ▼             ▼             ▼
          loading$       result$       error$
```

### LoadingState is data

```ts
type LoadingState<T, E = unknown> =
  | { readonly status: 'idle' }
  | { readonly status: 'loading' }
  | { readonly status: 'success'; readonly value: T }
  | { readonly status: 'error'; readonly error: E };
```

This avoids contradictory combinations such as `loading: true` together with both a value and an error.

### Request policy stays visible

The demo uses:

```ts
const userLoadingState$ = userId$.pipe(
  switchMap(id =>
    loadUser(id).pipe(
      map(user => success(user)),
      catchError(error => of(failure(error))),
      startWith(loading()),
    ),
  ),
  startWith(idle()),
  shareLatest(),
);
```

Each operator has one explicit role:

```text
switchMap()    → latest request wins; previous active request is cancelled
map()          → response becomes Success(value)
catchError()   → request error becomes Error(error) data
startWith()    → request begins in Loading state
shareLatest()  → one shared request lifecycle + latest state replay
```

`catchError` is deliberately **inside** `switchMap`. A failed request becomes an `error` LoadingState without terminating the outer request-intent stream, so later requests still work.

Cancellation is deliberately **not** another LoadingState variant. Cancellation is the execution policy expressed by `switchMap`, not an HTTP outcome.

The actual transport stays a named effect function:

```ts
const loadUser = (id: number): Observable<User> =>
  ajax.getJSON<User>(
    `https://jsonplaceholder.typicode.com/users/${id}`,
  );
```

The demo uses JSONPlaceholder's public `/users/:id` resource. The Load button remains enabled during `loading`, so a newer request intent can replace an active request and demonstrate `switchMap` semantics.

### HTTP design rule

> An HTTP request is a temporal state transition: **Idle → Loading → Success | Error**, governed by an explicit RxJS concurrency and cancellation policy.

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
- Sharing, replay, cancellation, and teardown policy are explicit.
- Subscription ownership and teardown are explicit.
- Two-way binding is modeled as two one-way dataflows.
- DOM sinks apply values; upstream streams decide what those values mean.
- Form Control state is data, not a mutable framework object.
- Validation rules are pure TypeScript functions.
- HTTP lifecycle is `LoadingState` data, not separate mutable loading/value/error flags.
- Flattening operators remain visible because they express request concurrency and cancellation policy.
- No framework and no change-detection mechanism are required.

## Contributors

- **ChatGPT by OpenAI — main contributor**: architecture, implementation, documentation, code refinement, and collaborative development of the project.
- **Hans Schenker — project owner and collaborator**: project direction, RxJS design principles, requirements, review, and repository stewardship.

> GitHub's native contributor graph is generated from commit authorship. This contributor list documents the actual collaborative contribution to the project independently of GitHub account identity.

## Roadmap

Next architectural steps:

1. `bindIf()` — reactive DOM lifetime / conditional mounting.
2. HTTP V2 — retry, timeout, refresh, and optional previous-value retention while reloading.
3. Router — browser location as a remembered route stream.
4. Router + HTTP — route selection drives request intent and cancellation.
5. Form Control V2 — disabled/enabled state and status projection.
6. Form Control V3 — asynchronous validation with an explicit cancellation policy.
7. `FormGroup` / `FormArray` — aggregate control state and validation.

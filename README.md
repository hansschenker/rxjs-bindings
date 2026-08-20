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
| `Router` | `NavigationCommand$` + History API |
| `ActivatedRoute` | `Route$` projections |
| route params | typed fields on `Route` |
| current route | remembered `Route$` via `shareLatest()` |
| Angular animations | `animationFrames()` + pure functions + `bindStyle()` |
| animation interruption | `switchMap()` |
| animation queueing | `concatMap()` |

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

## RxJS Router V1

Router V1 does **not** recreate Angular's `Router` or `ActivatedRoute` objects. Routing is modeled as typed route data flowing from browser location sources.

```text
initial browser location ─────┐
                              │
popstate$ ────────────────────┤
                              ├──► Location$
NavigationCommand$ ─► History ┤
                              │
                              ▼
                         map(parseRoute)
                              │
                              ▼
                            Route$
                              │
                         shareLatest()
                              │
                  ┌───────────┼───────────┐
                  ▼           ▼           ▼
              route type    params      route view
```

### Route is data

```ts
type Route =
  | { readonly type: 'home' }
  | { readonly type: 'user'; readonly id: number }
  | { readonly type: 'settings' }
  | { readonly type: 'notFound'; readonly pathname: string };
```

`parseRoute(location)` and `routeToUrl(route)` are pure TypeScript functions. They own route meaning; RxJS only coordinates values over time.

### Browser and application navigation are separate sources

Back/Forward navigation comes from the browser:

```ts
const historyLocation$ = fromEvent<PopStateEvent>(window, 'popstate').pipe(
  map(readBrowserLocation),
);
```

Application navigation is represented as typed commands:

```ts
type NavigationCommand = {
  readonly mode: 'push' | 'replace';
  readonly route: Route;
};
```

`history.pushState()` and `history.replaceState()` do not emit `popstate`, so after applying the History API effect, the resulting browser location is explicitly folded back into `Location$`.

```text
NavigationCommand$
      │
      │ tap(performNavigation)
      ▼
History API effect
      │
      │ map(readBrowserLocation)
      ▼
application Location$
```

### Current route is remembered

```ts
const route$ = location$.pipe(
  map(parseRoute),
  distinctUntilChanged(sameRoute),
  shareLatest(),
);
```

This gives route consumers one shared navigation execution and immediate access to the current route.

### Subject use is explicit and narrow

A `Subject<NavigationCommand>` is used only as the bridge for imperative application code that wants to navigate programmatically. It does not store route state. Route state remains `Route$`.

```ts
navigate({ type: 'user', id: 42 });
```

### Router design rule

> Route parsing is pure TypeScript, navigation mutation is an imperative History API effect, and temporal coordination is RxJS.

Router V1 intentionally postpones internal-link interception, query-parameter typing, guards, redirects, lazy views, and Router + HTTP composition until the core navigation machine is established.


## RxJS Animation V1

Animation V1 does **not** recreate Angular's animation DSL. An animation is modeled as values changing over browser frame time:

```text
animationFrames()
       │
       ▼
 elapsed frame time
       │
       ▼
 progress 0..1
       │
       │ map(easing)
       ▼
 eased progress
       │
       │ map(interpolation)
       ▼
 style value
       │
       ▼
 bindStyle()
       │
       ▼
      DOM
```

### Time is a source

RxJS 7 already exposes the browser animation clock through `animationFrames()`. The project adds one small helper that converts elapsed frame time into normalized progress:

```ts
export const progressOver = (
  durationMs: number,
): Observable<number> =>
  animationFrames().pipe(
    map(({ elapsed }) => clamp01(elapsed / durationMs)),
    startWith(0),
    takeWhile(progress => progress < 1, true),
  );
```

`progressOver(900)` emits values from `0` toward `1` and completes after the terminal `1` emission. The helper does not own easing, interpolation, or DOM effects.

### Easing and interpolation are pure TypeScript

```ts
type Easing = (progress: number) => number;

const easeInOutCubic: Easing = progress =>
  progress < 0.5
    ? 4 * progress * progress * progress
    : 1 - Math.pow(-2 * progress + 2, 3) / 2;

const lerp = (
  from: number,
  to: number,
  progress: number,
): number =>
  from + (to - from) * progress;
```

RxJS moves progress values to these functions; the pure functions decide how those values are transformed.

### One animation execution can drive many DOM properties

```ts
const progress$ = progressOver(900).pipe(
  map(easeInOutCubic),
  shareLatest(),
);
```

From that one shared progress stream, the demo derives transform, opacity, and progress text independently. `shareLatest()` prevents each DOM binding from creating its own animation-frame execution.

### Flattening operators are animation policies

The demo deliberately implements the same animation with two different policies.

Latest wins:

```ts
const latestProgress$ = click$.pipe(
  switchMap(() => progressOver(900).pipe(
    map(easeInOutCubic),
  )),
  startWith(0),
  shareLatest(),
);
```

A new click cancels the current run and starts the latest one.

Queue:

```ts
const queuedProgress$ = click$.pipe(
  concatMap(() => progressOver(900).pipe(
    map(easeInOutCubic),
  )),
  startWith(0),
  shareLatest(),
);
```

A new click waits until earlier runs complete.

This gives the flattening operators direct animation meaning:

```text
switchMap  → replace active animation with latest
concatMap  → queue animations
mergeMap   → allow animations to overlap
exhaustMap → ignore triggers while animation is active
```

### Angular animation correspondence

| Angular animation concept | RxJS + TypeScript |
| --- | --- |
| `trigger()` | event/state stream |
| `state()` | typed application state |
| `transition()` | state-transition stream |
| `animate()` | `animationFrames()` / `progressOver()` |
| easing string | pure `Easing` function |
| `style()` | `bindStyle()` |
| interruption policy | `switchMap()` |
| sequencing policy | `concatMap()` |

### Animation design rule

> An animation is a value changing over frame time. RxJS supplies time and execution policy, pure TypeScript computes the value, and `bindStyle()` applies it to the DOM.

Simple visual transitions should still use CSS when CSS is sufficient. RxJS animation is most useful when timing, cancellation, sequencing, route state, form state, HTTP state, or other application streams participate in the animation.

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
- Route parsing and serialization are pure TypeScript functions.
- Browser navigation is a source; History mutation is an explicit effect.
- Current route is a shared, remembered `Route$`, not a mutable router object.
- Animation time comes from `animationFrames()`; easing and interpolation stay pure.
- Animation interruption and queueing remain visible as flattening policies.
- No framework and no change-detection mechanism are required.

## Contributors

- **ChatGPT by OpenAI — main contributor**: architecture, implementation, documentation, code refinement, and collaborative development of the project.
- **Hans Schenker — project owner and collaborator**: project direction, RxJS design principles, requirements, review, and repository stewardship.

> GitHub's native contributor graph is generated from commit authorship. This contributor list documents the actual collaborative contribution to the project independently of GitHub account identity.

## Roadmap

Next architectural steps:

1. `bindIf()` — reactive DOM lifetime / conditional mounting.
2. Router + HTTP — route selection drives request intent and cancellation.
3. Router V2 — internal-link interception, query parameters, redirects, and typed NotFound handling.
4. HTTP V2 — retry, timeout, refresh, and optional previous-value retention while reloading.
5. Form Control V2 — disabled/enabled state and status projection.
6. Form Control V3 — asynchronous validation with an explicit cancellation policy.
7. `FormGroup` / `FormArray` — aggregate control state and validation.

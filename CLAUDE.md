# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

Minimal DOM data binding and application dataflow with RxJS 7, TypeScript JSX, and browser APIs — **no web framework, no React, no virtual DOM, no change detection**. The point of the project is to see how small the "framework" layer can stay while keeping time, state, cancellation, sharing, lifetime, and effects explicit.

This repo is standalone — it is **not** part of the `rxjs-ds` / `rxjs-vitepress-ds` component-sync pair described in the user-level CLAUDE.md; those sync rules do not apply here.

## Commands

```bash
npm run dev         # Vite dev server — main demo at /, CRUDL Todo sample at /sample/
npm run typecheck   # tsc --noEmit for src/ AND sample/ (sample has its own tsconfig)
npm run build       # build:lib + build:demo
npm run build:lib   # dist/ — library ES module (vite.lib.config.ts) + .d.ts (tsconfig.lib.json)
npm run build:demo  # dist-demo/ — demo site, MPA build including sample/index.html
npm run preview     # preview dist-demo
```

There is no test runner or linter configured.

## Packaging

This is an installable library: `exports`/`types` point into `dist/`, `rxjs` is a
peerDependency (also in devDependencies for local dev), `sideEffects: false`. The lib
build externalizes rxjs and bundles only what `src/index.ts` reaches — demo entry
points (`main.ts`, `*-demo.*`) stay out of the package. New public API must be
exported from `src/index.ts`.

## Architecture

Every feature follows the same three-phase dataflow:

1. **Enter RxJS**: DOM/browser events become sources via plain `fromEvent()` (never wrapped).
2. **Stay in RxJS**: actions → `scan(pureReducer)` → `startWith(initial)` → `shareLatest()` produces remembered state streams; RxJS operators are the visible temporal/concurrency policy, pure TypeScript functions own domain meaning.
3. **Exit RxJS**: projected streams (`map` + `distinctUntilChanged`) connect to imperative DOM sinks that each return the `Subscription`.

### `src/` modules

- `bindings.ts` — the five DOM sinks: `bindText`, `bindProperty`, `bindAttribute`, `bindClass`, `bindStyle`. Sinks only apply already-computed values; they contain no transformation logic.
- `bind-if.ts` / `bind-list.ts` / `bind-route-view.ts` — structural bindings: they convert stream emissions into view lifetimes (mount/teardown/DOM placement) and each require a dedicated host element. `bindList` gives each key one view for its whole lifetime and feeds item changes through a per-key `BehaviorSubject`-backed `Observable<T>` so views update in place (preserving focus), with minimal DOM moves. `bindRouteView` replaces the mounted view per route emission; dedup policy (`distinctUntilChanged(sameRoute)`) stays upstream.
- `share-latest.ts` — `shareLatest()` = `shareReplay({ bufferSize: 1, refCount: true })`; the canonical sharing policy for all remembered state.
- `jsx.ts` — classic JSX factory (`jsx` / `Fragment`) that creates real DOM nodes. It deliberately **throws** on `on*` event props and on Observable children. JSX types live in the factory-scoped `jsx.JSX` namespace (via declaration merging), NOT a global `JSX` namespace — do not reintroduce `declare global`; it would collide with other JSX runtimes in consuming apps.
- `index.ts` — the library's public entry; everything packaged must be exported here.
- `view.ts` — `View = { node, lifetime: Subscription }` plus `createView` / `mountView` / `mountApp`. `Subscription` **is** the view lifecycle; there is no onDestroy/hook system.
- `form-control.ts` — `ControlState<T>` reducer + pure `Validator<T>` functions. Only genuine state is stored (`value`, `dirty`, `touched`, `errors`); `valid`/`pristine`/etc. are projections.
- `loading-state.ts` — `LoadingState<T>` discriminated union (`idle | loading | success | error`) with constructor helpers. Cancellation is not a state variant — it is the flattening operator's policy (`switchMap`).
- `router.ts` — typed `Route` union, pure `parseRoute` / `routeToUrl` / `sameRoute`. Browser `popstate` is a source; History API mutation is an explicit effect folded back into `Location$`.
- `animation.ts` — `progressOver(durationMs)` built on `animationFrames()`, plus pure easing/interpolation. Flattening operators are the animation policy (`switchMap` = interrupt, `concatMap` = queue).
- `main.ts`, `router-demo.tsx`, `animation-demo.ts`, `view-demo.tsx` — demo entry points, all loaded together by `index.html`. Not part of the library build. `router-demo.tsx` also demonstrates the Router + HTTP composition (`Route$` → pure intent projection → `switchMap` → `LoadingState$`) — deliberately a composition of existing primitives, not a new core API.

### `sample/` — CRUDL Todo app

End-to-end proof that the pieces compose: core `bindList` renders the Todo rows, core `bindIf` mounts the details panel only while a selection exists. Has its own `tsconfig.json` that lists exactly the core modules it uses — add to that list when the sample adopts another core module. Project principle: abstractions are proved in a real app in `sample/` **before** being promoted into `src/` (this is how `bindList` earned its place).

### JSX configuration

Classic transform with a custom factory. `tsconfig.json` (`"jsx": "react"`, `jsxFactory: "jsx"`, `jsxFragmentFactory: "Fragment"`) and `vite.config.ts` (`esbuild.jsxFactory` / `jsxFragment`) must stay in agreement.

## Design rules (enforced, not aspirational)

- **Never hide standard RxJS behind domain aliases.** `fromEvent`, `map`, `scan`, `switchMap`, `concatMap` etc. stay visible; there is no `bindEvent()` and there never should be. Prefer `map(priceCart)` over a custom named operator.
- **JSX owns structure only.** No Observable children, no event props — reactivity is wired explicitly afterwards via `bindX(element, value$)` and `fromEvent(element, ...)`.
- **State is data**: readonly discriminated-union types, evolved by pure reducers via `scan(...) + startWith(...) + shareLatest()`. Derived values are stream projections, never stored fields.
- **Two-way binding is two one-way flows** (`fromEvent` in, `bindProperty` out).
- **Subjects are bridges only** — a narrow imperative→reactive entry point (e.g. programmatic navigation, dynamic Todo-row actions), never state containers.
- **Callers own Subscriptions.** Every sink returns its `Subscription`; teardown is explicit, and inside `createView` builders every binding is registered on the `lifetime`.
- `catchError` for request pipelines belongs **inside** the flattening operator so a failed request becomes error data without killing the outer intent stream.

## Docs

`README.md` documents each feature (bindings, structural bindings, form control, LoadingState, router, animation, JSX view, packaging) with its design rule, Angular correspondences, and the roadmap. `rxjs-bindings-project.md` is the conceptual overview. Both are maintained as first-class deliverables — a new feature or API change should update the relevant README section and its design-principles list.

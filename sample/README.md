# CRUDL Todo — rxjs-bindings proof

This sample is the end-to-end proof for `rxjs-bindings`.

It implements **CRUDL**:

- **Create** — submit a new Todo.
- **Read** — select a Todo and project it into the details panel.
- **Update** — rename a Todo or toggle its completed state.
- **Delete** — remove a Todo.
- **List** — render the current Todo collection with keyed JSX views.

## Architecture

```text
DOM events
   │
   ▼
fromEvent()
   │
   ▼
TodoAction$
   │
   ▼
scan(reduceTodoState)
   │
   ▼
shareLatest()
   │
   ▼
TodoState$
   │
   ├──► bindText / bindProperty / bindClass / bindAttribute
   ├──► keyed JSX Todo views
   └──► localStorage persistence effect
```

JSX creates DOM structure only. Events enter through `fromEvent()`. Observable
values are connected to DOM sinks explicitly. Dynamic Todo-row actions use a
`Subject<TodoAction>` only as an imperative-to-reactive bridge; state itself is
owned by `scan(...) + shareLatest()`.

The sample-local `bindKeyedList()` is intentionally not part of `src/` yet. It
serves as the concrete proving ground for the future core `bindList()` API.

## Run

From the repository root:

```bash
npm install
npm run dev
```

Then open the Vite URL at `/sample/`.

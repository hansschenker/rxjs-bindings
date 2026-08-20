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
   ├──► bindList() — keyed Todo item views with per-item Todo$ streams
   ├──► bindIf() — details panel mounted only while a Todo is selected
   └──► localStorage persistence effect
```

JSX creates DOM structure only. Events enter through `fromEvent()`. Observable
values are connected to DOM sinks explicitly. Dynamic Todo-row actions use a
`Subject<TodoAction>` only as an imperative-to-reactive bridge; state itself is
owned by `scan(...) + shareLatest()`.

The list uses the core `bindList()`: each Todo key gets one item view whose
changes arrive through its own remembered `Todo$` stream, so a rename or
toggle updates the existing row in place — uncommitted text and focus in the
row's rename input survive. The read panel uses the core `bindIf()`: closing
the selection unsubscribes the whole panel view, so its bindings and the close
button's event stream do not outlive the selection.

This sample previously carried a sample-local `bindKeyedList()` as the proving
ground for the core list API. That abstraction has been promoted into `src/`
as `bindList()`, upgraded with per-item streams and minimal DOM moves.

## Run

From the repository root:

```bash
npm install
npm run dev
```

Then open the Vite URL at `/sample/`.

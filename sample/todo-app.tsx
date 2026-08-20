import {
  Subject,
  distinctUntilChanged,
  filter,
  fromEvent,
  map,
  merge,
  scan,
  startWith,
  tap,
  type Observable,
} from 'rxjs';
import { bindIf } from '../src/bind-if';
import { bindList } from '../src/bind-list';
import {
  bindAttribute,
  bindClass,
  bindProperty,
  bindText,
} from '../src/bindings';
import { Fragment, jsx } from '../src/jsx';
import { shareLatest } from '../src/share-latest';
import { createView, mountApp, type View } from '../src/view';
import {
  countCompleted,
  createInitialTodoState,
  createTodo,
  normalizeTitle,
  reduceTodoState,
  sameTodo,
  selectTodoById,
  type Todo,
  type TodoAction,
  type TodoId,
} from './todo-domain';

const storageKey = 'rxjs-bindings.todos.v1';

const loadTodos = (): readonly Todo[] => {
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw === null) return [];

    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];

    return value.flatMap(item => {
      if (
        item !== null
        && typeof item === 'object'
        && 'id' in item
        && 'title' in item
        && 'completed' in item
        && typeof item.id === 'string'
        && typeof item.title === 'string'
        && typeof item.completed === 'boolean'
      ) {
        return [{
          id: item.id,
          title: item.title,
          completed: item.completed,
        } satisfies Todo];
      }

      return [];
    });
  } catch {
    return [];
  }
};

const saveTodos = (todos: readonly Todo[]): void => {
  localStorage.setItem(storageKey, JSON.stringify(todos));
};

const newTodoId = (): string => crypto.randomUUID();

// One view per Todo key for its whole list lifetime. Item changes arrive
// through todo$ and update the existing DOM in place, so focus and text
// selection inside the row survive renames and toggles elsewhere.
const createTodoItemView = (
  todo$: Observable<Todo>,
  todoId: TodoId,
  actionSink: Subject<TodoAction>,
): View<HTMLLIElement> =>
  createView(lifetime => {
    const checkbox = <input type="checkbox" /> as HTMLInputElement;
    const title = <strong /> as HTMLElement;
    const editInput = <input type="text" /> as HTMLInputElement;
    const editForm = (
      <form class="todo-edit-form">
        {editInput}
        <button type="submit">Rename</button>
      </form>
    ) as HTMLFormElement;
    const readButton = (
      <button type="button">Read details</button>
    ) as HTMLButtonElement;
    const deleteButton = (
      <button type="button">Delete</button>
    ) as HTMLButtonElement;
    const item = (
      <li class="todo" data-id={todoId}>
        <label class="todo-toggle">
          {checkbox}
          {title}
        </label>
        {editForm}
        <div class="todo-actions">
          {readButton}
          {deleteButton}
        </div>
      </li>
    ) as HTMLLIElement;

    const title$ = todo$.pipe(
      map(todo => todo.title),
      distinctUntilChanged(),
    );

    const completed$ = todo$.pipe(
      map(todo => todo.completed),
      distinctUntilChanged(),
    );

    lifetime.add(bindText(title, title$));
    lifetime.add(bindProperty(checkbox, 'checked', completed$));
    lifetime.add(bindProperty(editInput, 'value', title$));
    lifetime.add(bindClass(item, 'completed', completed$));
    lifetime.add(bindAttribute(editInput, 'aria-label', title$.pipe(
      map(currentTitle => `Rename ${currentTitle}`),
    )));

    lifetime.add(
      fromEvent(checkbox, 'change').pipe(
        map((): TodoAction => ({ type: 'toggled', id: todoId })),
      ).subscribe(actionSink),
    );

    lifetime.add(
      fromEvent(editForm, 'submit').pipe(
        tap(event => event.preventDefault()),
        map(() => normalizeTitle(editInput.value)),
        filter(renamedTitle => renamedTitle !== ''),
        map((renamedTitle): TodoAction => ({
          type: 'renamed',
          id: todoId,
          title: renamedTitle,
        })),
      ).subscribe(actionSink),
    );

    lifetime.add(
      fromEvent(readButton, 'click').pipe(
        map((): TodoAction => ({ type: 'selected', id: todoId })),
      ).subscribe(actionSink),
    );

    lifetime.add(
      fromEvent(deleteButton, 'click').pipe(
        map((): TodoAction => ({ type: 'deleted', id: todoId })),
      ).subscribe(actionSink),
    );

    return item;
  });

const createTodoAppView = () =>
  createView(lifetime => {
    const actionSink = new Subject<TodoAction>();
    lifetime.add(() => actionSink.complete());

    const titleInput = (
      <input
        type="text"
        autocomplete="off"
        placeholder="What needs to be done?"
        aria-label="New todo title"
      />
    ) as HTMLInputElement;
    const createButton = (
      <button type="submit">Create todo</button>
    ) as HTMLButtonElement;
    const createForm = (
      <form class="todo-create-form">
        {titleInput}
        {createButton}
      </form>
    ) as HTMLFormElement;

    const list = <ul class="todo-list" /> as HTMLUListElement;
    const totalElement = <strong /> as HTMLElement;
    const completedElement = <strong /> as HTMLElement;
    const activeElement = <strong /> as HTMLElement;
    const selectedPanelHost = <div /> as HTMLElement;

    const initialState = createInitialTodoState(loadTodos());

    const draftChanged$ = fromEvent<InputEvent>(titleInput, 'input').pipe(
      map(event => ({
        type: 'draftChanged',
        draft: (event.currentTarget as HTMLInputElement).value,
      } satisfies TodoAction)),
    );

    const created$ = fromEvent(createForm, 'submit').pipe(
      tap(event => event.preventDefault()),
      map(() => normalizeTitle(titleInput.value)),
      filter(title => title !== ''),
      map(title => ({
        type: 'created',
        todo: createTodo(newTodoId(), title),
      } satisfies TodoAction)),
    );

    const action$ = merge(
      draftChanged$,
      created$,
      actionSink,
    );

    const state$ = action$.pipe(
      scan(reduceTodoState, initialState),
      startWith(initialState),
      shareLatest(),
    );

    const todos$ = state$.pipe(
      map(state => state.todos),
      distinctUntilChanged(),
    );

    const draft$ = state$.pipe(
      map(state => state.draft),
      distinctUntilChanged(),
    );

    const total$ = todos$.pipe(
      map(todos => todos.length),
      distinctUntilChanged(),
    );

    const completed$ = todos$.pipe(
      map(countCompleted),
      distinctUntilChanged(),
    );

    const active$ = todos$.pipe(
      map(todos => todos.length - countCompleted(todos)),
      distinctUntilChanged(),
    );

    const selectedTodo$ = state$.pipe(
      map(selectTodoById),
      distinctUntilChanged((left, right) =>
        left === right
        || (left !== null && right !== null && sameTodo(left, right)),
      ),
    );

    const selectedTitle$ = selectedTodo$.pipe(
      map(todo => todo?.title ?? ''),
      distinctUntilChanged(),
    );

    const selectedStatus$ = selectedTodo$.pipe(
      map(todo => todo === null ? '' : todo.completed ? 'completed' : 'active'),
      distinctUntilChanged(),
    );

    const hasSelection$ = selectedTodo$.pipe(
      map(todo => todo !== null),
      distinctUntilChanged(),
    );

    // The read panel mounts only while a Todo is selected. bindIf tears the
    // whole branch view down on deselection, so its bindings and the close
    // button's event stream do not outlive the selection.
    const createSelectedPanelView = (): View<HTMLElement> =>
      createView(panelLifetime => {
        const selectedTitle = <strong /> as HTMLElement;
        const selectedStatus = <span /> as HTMLElement;
        const clearSelectionButton = (
          <button type="button">Close details</button>
        ) as HTMLButtonElement;

        panelLifetime.add(bindText(selectedTitle, selectedTitle$));
        panelLifetime.add(bindText(selectedStatus, selectedStatus$));

        panelLifetime.add(
          fromEvent(clearSelectionButton, 'click').pipe(
            map((): TodoAction => ({ type: 'selectionCleared' })),
          ).subscribe(actionSink),
        );

        return (
          <section class="todo-read-panel">
            <h2>Read selected todo</h2>
            <p>Title: {selectedTitle}</p>
            <p>Status: {selectedStatus}</p>
            {clearSelectionButton}
          </section>
        ) as HTMLElement;
      });

    lifetime.add(bindProperty(titleInput, 'value', draft$));
    lifetime.add(bindText(totalElement, total$));
    lifetime.add(bindText(completedElement, completed$));
    lifetime.add(bindText(activeElement, active$));

    lifetime.add(
      bindIf(selectedPanelHost, hasSelection$, createSelectedPanelView),
    );

    lifetime.add(
      bindList(
        list,
        todos$,
        todo => todo.id,
        (todo$, todoId) => createTodoItemView(todo$, todoId, actionSink),
        sameTodo,
      ),
    );

    lifetime.add(
      todos$.subscribe(saveTodos),
    );

    return (
      <main class="todo-app">
        <header>
          <p class="eyebrow">rxjs-bindings / final proof</p>
          <h1>CRUDL Todo</h1>
          <p>
            JSX builds structure. RxJS owns events, state, projections,
            persistence flow, and lifetime. Standard operators stay visible.
          </p>
        </header>

        <section aria-labelledby="createTodoTitle">
          <h2 id="createTodoTitle">Create</h2>
          {createForm}
        </section>

        <section aria-labelledby="listTodoTitle">
          <div class="section-heading">
            <h2 id="listTodoTitle">List</h2>
            <p>
              total {totalElement} · active {activeElement} · completed {completedElement}
            </p>
          </div>
          {list}
        </section>

        {selectedPanelHost}

        <footer>
          <p>
            Update = rename or toggle. Delete = remove. Read = select details.
            State persists in localStorage.
          </p>
        </footer>
      </main>
    ) as HTMLElement;
  });

const host = document.querySelector<HTMLElement>('#todoApp')!;
const appLifetime = mountApp(host, createTodoAppView());

window.addEventListener(
  'pagehide',
  () => appLifetime.unsubscribe(),
  { once: true },
);

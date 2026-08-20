export type TodoId = string;

export type Todo = {
  readonly id: TodoId;
  readonly title: string;
  readonly completed: boolean;
};

export type TodoState = {
  readonly todos: readonly Todo[];
  readonly draft: string;
  readonly selectedId: TodoId | null;
};

export type TodoAction =
  | { readonly type: 'draftChanged'; readonly draft: string }
  | { readonly type: 'created'; readonly todo: Todo }
  | { readonly type: 'renamed'; readonly id: TodoId; readonly title: string }
  | { readonly type: 'toggled'; readonly id: TodoId }
  | { readonly type: 'deleted'; readonly id: TodoId }
  | { readonly type: 'selected'; readonly id: TodoId }
  | { readonly type: 'selectionCleared' };

export const normalizeTitle = (title: string): string => title.trim();

export const createTodo = (
  id: TodoId,
  title: string,
): Todo => ({
  id,
  title: normalizeTitle(title),
  completed: false,
});

export const createInitialTodoState = (
  todos: readonly Todo[] = [],
): TodoState => ({
  todos,
  draft: '',
  selectedId: null,
});

const replaceTodo = (
  todos: readonly Todo[],
  id: TodoId,
  update: (todo: Todo) => Todo,
): readonly Todo[] =>
  todos.map(todo => todo.id === id ? update(todo) : todo);

export const reduceTodoState = (
  state: TodoState,
  action: TodoAction,
): TodoState => {
  switch (action.type) {
    case 'draftChanged':
      return {
        ...state,
        draft: action.draft,
      };

    case 'created':
      if (action.todo.title === '') return state;

      return {
        ...state,
        todos: [...state.todos, action.todo],
        draft: '',
        selectedId: action.todo.id,
      };

    case 'renamed': {
      const title = normalizeTitle(action.title);
      if (title === '') return state;

      return {
        ...state,
        todos: replaceTodo(
          state.todos,
          action.id,
          todo => ({ ...todo, title }),
        ),
      };
    }

    case 'toggled':
      return {
        ...state,
        todos: replaceTodo(
          state.todos,
          action.id,
          todo => ({ ...todo, completed: !todo.completed }),
        ),
      };

    case 'deleted':
      return {
        ...state,
        todos: state.todos.filter(todo => todo.id !== action.id),
        selectedId: state.selectedId === action.id ? null : state.selectedId,
      };

    case 'selected':
      return state.todos.some(todo => todo.id === action.id)
        ? { ...state, selectedId: action.id }
        : state;

    case 'selectionCleared':
      return {
        ...state,
        selectedId: null,
      };
  }
};

export const selectTodoById = (
  state: TodoState,
): Todo | null =>
  state.selectedId === null
    ? null
    : state.todos.find(todo => todo.id === state.selectedId) ?? null;

export const countCompleted = (todos: readonly Todo[]): number =>
  todos.filter(todo => todo.completed).length;

export const sameTodo = (left: Todo, right: Todo): boolean =>
  left.id === right.id
  && left.title === right.title
  && left.completed === right.completed;

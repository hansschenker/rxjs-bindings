import {
  catchError,
  distinctUntilChanged,
  fromEvent,
  map,
  merge,
  Observable,
  of,
  scan,
  startWith,
  switchMap,
} from 'rxjs';
import { ajax } from 'rxjs/ajax';
import {
  bindAttribute,
  bindClass,
  bindProperty,
  bindStyle,
  bindText,
} from './bindings';
import {
  createInitialControlState,
  reduceControlState,
  type ControlAction,
  type Validator,
} from './form-control';
import {
  failure,
  idle,
  loading,
  success,
  type LoadingState,
} from './loading-state';
import { shareLatest } from './share-latest';

type State = {
  readonly title: string;
  readonly name: string;
  readonly count: number;
};

type Action =
  | { readonly type: 'nameChanged'; readonly name: string }
  | { readonly type: 'increment' }
  | { readonly type: 'decrement' }
  | { readonly type: 'reset' };

type User = {
  readonly id: number;
  readonly name: string;
  readonly username: string;
  readonly email: string;
  readonly phone: string;
  readonly website: string;
};

const initialState: State = {
  title: 'RxJS Bindings',
  name: '',
  count: 0,
};

const reduceState = (state: State, action: Action): State => {
  switch (action.type) {
    case 'nameChanged':
      return { ...state, name: action.name };
    case 'increment':
      return { ...state, count: state.count + 1 };
    case 'decrement':
      return { ...state, count: Math.max(0, state.count - 1) };
    case 'reset':
      return initialState;
  }
};

const required: Validator<string> = value =>
  value.trim() === '' ? { required: true } : null;

const minLength = (requiredLength: number): Validator<string> => value =>
  value.length < requiredLength
    ? {
        minLength: {
          requiredLength,
          actualLength: value.length,
        },
      }
    : null;

const loadUser = (id: number): Observable<User> =>
  ajax.getJSON<User>(`https://jsonplaceholder.typicode.com/users/${id}`);

const formatUser = (user: User): string => JSON.stringify(user, null, 2);

const formatError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const titleElement = document.querySelector<HTMLHeadingElement>('#title')!;
const nameElement = document.querySelector<HTMLElement>('#name')!;
const countElement = document.querySelector<HTMLElement>('#count')!;
const nameInput = document.querySelector<HTMLInputElement>('#nameInput')!;
const incrementButton = document.querySelector<HTMLButtonElement>('#increment')!;
const decrementButton = document.querySelector<HTMLButtonElement>('#decrement')!;
const resetButton = document.querySelector<HTMLButtonElement>('#reset')!;

const emailInput = document.querySelector<HTMLInputElement>('#emailInput')!;
const emailSetExampleButton =
  document.querySelector<HTMLButtonElement>('#emailSetExample')!;
const emailResetButton =
  document.querySelector<HTMLButtonElement>('#emailReset')!;
const emailValueElement = document.querySelector<HTMLElement>('#emailValue')!;
const emailValidElement = document.querySelector<HTMLElement>('#emailValid')!;
const emailDirtyElement = document.querySelector<HTMLElement>('#emailDirty')!;
const emailTouchedElement = document.querySelector<HTMLElement>('#emailTouched')!;
const emailErrorsElement = document.querySelector<HTMLElement>('#emailErrors')!;

const httpSection = document.querySelector<HTMLElement>('#httpSection')!;
const userIdInput = document.querySelector<HTMLInputElement>('#userIdInput')!;
const userLoadButton = document.querySelector<HTMLButtonElement>('#userLoad')!;
const userStatusElement = document.querySelector<HTMLElement>('#userStatus')!;
const userLoadingElement = document.querySelector<HTMLElement>('#userLoading')!;
const userResultElement = document.querySelector<HTMLElement>('#userResult')!;
const userErrorElement = document.querySelector<HTMLElement>('#userError')!;

// ENTER RXJS WORLD: DOM events become source streams.
const nameChanged$ = fromEvent<InputEvent>(nameInput, 'input').pipe(
  map(event => ({
    type: 'nameChanged',
    name: (event.currentTarget as HTMLInputElement).value,
  } satisfies Action)),
);

const increment$ = fromEvent(incrementButton, 'click').pipe(
  map(() => ({ type: 'increment' } satisfies Action)),
);

const decrement$ = fromEvent(decrementButton, 'click').pipe(
  map(() => ({ type: 'decrement' } satisfies Action)),
);

const reset$ = fromEvent(resetButton, 'click').pipe(
  map(() => ({ type: 'reset' } satisfies Action)),
);

// STAY IN RXJS WORLD: actions flow into remembered application state.
const action$ = merge(nameChanged$, increment$, decrement$, reset$);

const state$ = action$.pipe(
  scan(reduceState, initialState),
  startWith(initialState),
  shareLatest(),
);

const title$ = state$.pipe(
  map(state => state.title),
  distinctUntilChanged(),
);

const name$ = state$.pipe(
  map(state => state.name),
  distinctUntilChanged(),
);

const count$ = state$.pipe(
  map(state => state.count),
  distinctUntilChanged(),
);

const decrementDisabled$ = state$.pipe(
  map(state => state.count === 0),
  distinctUntilChanged(),
);

const nameTitle$ = state$.pipe(
  map(state => state.name === '' ? null : `Current name: ${state.name}`),
  distinctUntilChanged(),
);

const countIsZero$ = state$.pipe(
  map(state => state.count === 0),
  distinctUntilChanged(),
);

const countFontSize$ = state$.pipe(
  map(state =>
    state.count === 0
      ? null
      : `${1 + Math.min(state.count, 5) * 0.1}rem`,
  ),
  distinctUntilChanged(),
);

// FORM CONTROL: DOM events and programmatic commands become ControlAction values.
const emailInitialValue: string = '';
const emailValidators: readonly Validator<string>[] = [required, minLength(5)];
const emailInitialState = createInitialControlState(
  emailInitialValue,
  emailValidators,
);

const emailUserValueChanged$ = fromEvent<InputEvent>(emailInput, 'input').pipe(
  map(event => ({
    type: 'userValueChanged',
    value: (event.currentTarget as HTMLInputElement).value,
  } satisfies ControlAction<string>)),
);

const emailBlurred$ = fromEvent<FocusEvent>(emailInput, 'blur').pipe(
  map(() => ({ type: 'blurred' } satisfies ControlAction<string>)),
);

const emailSetExample$ = fromEvent(emailSetExampleButton, 'click').pipe(
  map(() => ({
    type: 'setValue',
    value: 'rxjs@example.com',
  } satisfies ControlAction<string>)),
);

const emailReset$ = fromEvent(emailResetButton, 'click').pipe(
  map(() => ({ type: 'reset' } satisfies ControlAction<string>)),
);

const emailAction$ = merge(
  emailUserValueChanged$,
  emailBlurred$,
  emailSetExample$,
  emailReset$,
);

const emailState$ = emailAction$.pipe(
  scan(
    reduceControlState(emailInitialValue, emailValidators),
    emailInitialState,
  ),
  startWith(emailInitialState),
  shareLatest(),
);

const emailValue$ = emailState$.pipe(
  map(state => state.value),
  distinctUntilChanged(),
);

const emailInvalid$ = emailState$.pipe(
  map(state => state.errors !== null),
  distinctUntilChanged(),
);

const emailValidText$ = emailInvalid$.pipe(
  map(invalid => String(!invalid)),
);

const emailDirtyText$ = emailState$.pipe(
  map(state => String(state.dirty)),
  distinctUntilChanged(),
);

const emailTouchedText$ = emailState$.pipe(
  map(state => String(state.touched)),
  distinctUntilChanged(),
);

const emailErrorsText$ = emailState$.pipe(
  map(state => state.errors === null ? 'none' : JSON.stringify(state.errors)),
  distinctUntilChanged(),
);

const emailAriaInvalid$ = emailInvalid$.pipe(
  map(invalid => String(invalid)),
);

// HTTP: request intents choose an explicit latest-request-wins policy.
const userId$ = fromEvent(userLoadButton, 'click').pipe(
  map(() => Number(userIdInput.value)),
);

const userLoadingState$ = userId$.pipe(
  switchMap(id =>
    loadUser(id).pipe(
      map(success),
      catchError((error: unknown) => of(failure(error))),
      startWith(loading()),
    ),
  ),
  startWith(idle()),
  shareLatest<LoadingState<User>>(),
);

const userLoading$ = userLoadingState$.pipe(
  map(state => state.status === 'loading'),
  distinctUntilChanged(),
);

const userStatus$ = userLoadingState$.pipe(
  map(state => state.status),
  distinctUntilChanged(),
);

const userLoadingText$ = userLoading$.pipe(
  map(isLoading => String(isLoading)),
);

const userResultText$ = userLoadingState$.pipe(
  map(state => state.status === 'success' ? formatUser(state.value) : ''),
  distinctUntilChanged(),
);

const userErrorText$ = userLoadingState$.pipe(
  map(state => state.status === 'error' ? formatError(state.error) : ''),
  distinctUntilChanged(),
);

const userAriaBusy$ = userLoading$.pipe(
  map(isLoading => isLoading ? 'true' : null),
);

const userHasError$ = userLoadingState$.pipe(
  map(state => state.status === 'error'),
  distinctUntilChanged(),
);

// EXIT RXJS WORLD: state projections are connected to imperative DOM sinks.
const bindings = [
  bindText(titleElement, title$),
  bindText(nameElement, name$),
  bindText(countElement, count$),
  bindProperty(nameInput, 'value', name$),
  bindProperty(decrementButton, 'disabled', decrementDisabled$),
  bindAttribute(nameElement, 'title', nameTitle$),
  bindClass(countElement, 'is-zero', countIsZero$),
  bindStyle(countElement, 'font-size', countFontSize$),

  bindProperty(emailInput, 'value', emailValue$),
  bindAttribute(emailInput, 'aria-invalid', emailAriaInvalid$),
  bindClass(emailInput, 'invalid', emailInvalid$),
  bindText(emailValueElement, emailValue$),
  bindText(emailValidElement, emailValidText$),
  bindText(emailDirtyElement, emailDirtyText$),
  bindText(emailTouchedElement, emailTouchedText$),
  bindText(emailErrorsElement, emailErrorsText$),

  bindAttribute(httpSection, 'aria-busy', userAriaBusy$),
  bindClass(httpSection, 'loading', userLoading$),
  bindClass(httpSection, 'has-error', userHasError$),
  bindText(userStatusElement, userStatus$),
  bindText(userLoadingElement, userLoadingText$),
  bindText(userResultElement, userResultText$),
  bindText(userErrorElement, userErrorText$),
];

// Explicit lifecycle/cancellation boundary for the demo.
const destroy = () => bindings.forEach(subscription => subscription.unsubscribe());
window.addEventListener('pagehide', destroy, { once: true });

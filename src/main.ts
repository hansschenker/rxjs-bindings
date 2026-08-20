import {
  fromEvent,
  map,
  merge,
  scan,
  shareReplay,
  startWith,
  distinctUntilChanged,
} from 'rxjs';
import { bindProperty, bindText } from './bindings';

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

const titleElement = document.querySelector<HTMLHeadingElement>('#title')!;
const nameElement = document.querySelector<HTMLElement>('#name')!;
const countElement = document.querySelector<HTMLElement>('#count')!;
const nameInput = document.querySelector<HTMLInputElement>('#nameInput')!;
const incrementButton = document.querySelector<HTMLButtonElement>('#increment')!;
const decrementButton = document.querySelector<HTMLButtonElement>('#decrement')!;
const resetButton = document.querySelector<HTMLButtonElement>('#reset')!;

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
  shareReplay({ bufferSize: 1, refCount: true }),
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

// EXIT RXJS WORLD: state projections are connected to imperative DOM sinks.
const bindings = [
  bindText(titleElement, title$),
  bindText(nameElement, name$),
  bindText(countElement, count$),
  bindProperty(nameInput, 'value', name$),
  bindProperty(decrementButton, 'disabled', decrementDisabled$),
];

// Explicit lifecycle/cancellation boundary for the demo.
const destroy = () => bindings.forEach(subscription => subscription.unsubscribe());
window.addEventListener('pagehide', destroy, { once: true });

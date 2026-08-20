import {
  fromEvent,
  map,
  merge,
  scan,
  startWith,
} from 'rxjs';
import {
  bindAttribute,
  bindProperty,
  bindText,
} from './bindings';
import { Fragment, jsx } from './jsx';
import { shareLatest } from './share-latest';
import { createView, mountApp } from './view';

type CounterAction =
  | { readonly type: 'increment' }
  | { readonly type: 'decrement' }
  | { readonly type: 'reset' };

const reduceCount = (count: number, action: CounterAction): number => {
  switch (action.type) {
    case 'increment':
      return count + 1;
    case 'decrement':
      return Math.max(0, count - 1);
    case 'reset':
      return 0;
  }
};

type CounterControlsProps = {
  readonly decrementButton: HTMLButtonElement;
  readonly incrementButton: HTMLButtonElement;
  readonly resetButton: HTMLButtonElement;
};

const CounterControls = ({
  decrementButton,
  incrementButton,
  resetButton,
}: CounterControlsProps): Node => (
  <div class="row">
    {decrementButton}
    {incrementButton}
    {resetButton}
  </div>
);

const createCounterView = () =>
  createView(lifetime => {
    const countElement = <strong /> as HTMLElement;
    const decrementButton = (
      <button type="button">−</button>
    ) as HTMLButtonElement;
    const incrementButton = (
      <button type="button">+</button>
    ) as HTMLButtonElement;
    const resetButton = (
      <button type="button">Reset JSX view</button>
    ) as HTMLButtonElement;

    const decrement$ = fromEvent(decrementButton, 'click').pipe(
      map((): CounterAction => ({ type: 'decrement' })),
    );

    const increment$ = fromEvent(incrementButton, 'click').pipe(
      map((): CounterAction => ({ type: 'increment' })),
    );

    const reset$ = fromEvent(resetButton, 'click').pipe(
      map((): CounterAction => ({ type: 'reset' })),
    );

    const count$ = merge(decrement$, increment$, reset$).pipe(
      scan(reduceCount, 0),
      startWith(0),
      shareLatest(),
    );

    const decrementDisabled$ = count$.pipe(
      map(count => count === 0),
    );

    const countLabel$ = count$.pipe(
      map(count => `Current JSX view count: ${count}`),
    );

    lifetime.add(bindText(countElement, count$));
    lifetime.add(bindProperty(decrementButton, 'disabled', decrementDisabled$));
    lifetime.add(bindAttribute(countElement, 'aria-label', countLabel$));

    return (
      <section class="jsx-view" aria-labelledby="jsxViewTitle">
        <h2 id="jsxViewTitle">TypeScript JSX View V1</h2>
        <>
          <p>
            JSX creates the DOM structure. RxJS remains visible for events,
            state, sharing, and bindings.
          </p>
          <p>
            Counter from the mounted view: {countElement}
          </p>
        </>
        <CounterControls
          decrementButton={decrementButton}
          incrementButton={incrementButton}
          resetButton={resetButton}
        />
        <p>
          <code>View = DOM node + Subscription lifetime</code>
        </p>
      </section>
    ) as HTMLElement;
  });

const host = document.querySelector<HTMLElement>('#jsxViewHost')!;
const appLifetime = mountApp(host, createCounterView());

window.addEventListener(
  'pagehide',
  () => appLifetime.unsubscribe(),
  { once: true },
);

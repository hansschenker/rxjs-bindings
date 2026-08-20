import {
  Subject,
  catchError,
  distinctUntilChanged,
  fromEvent,
  map,
  merge,
  of,
  startWith,
  switchMap,
  tap,
  type Observable,
} from 'rxjs';
import { ajax } from 'rxjs/ajax';
import {
  bindAttribute,
  bindClass,
  bindText,
} from './bindings';
import { bindRouteView } from './bind-route-view';
import { jsx } from './jsx';
import {
  failure,
  idle,
  loading,
  success,
  type LoadingState,
} from './loading-state';
import {
  locationToUrl,
  parseRoute,
  routeToUrl,
  sameRoute,
  type BrowserLocation,
  type NavigationCommand,
  type NavigationMode,
  type Route,
} from './router';
import { shareLatest } from './share-latest';
import { createView, type View } from './view';

const routerSection = document.querySelector<HTMLElement>('#routerSection')!;
const routeUrlElement = document.querySelector<HTMLElement>('#routeUrl')!;
const routeTypeElement = document.querySelector<HTMLElement>('#routeType')!;
const routeParamsElement = document.querySelector<HTMLElement>('#routeParams')!;
const routeRequestElement = document.querySelector<HTMLElement>('#routeRequest')!;
const routeViewElement = document.querySelector<HTMLElement>('#routeView')!;

const routeHomeButton = document.querySelector<HTMLButtonElement>('#routeHome')!;
const routeUser1Button = document.querySelector<HTMLButtonElement>('#routeUser1')!;
const routeUser2Button = document.querySelector<HTMLButtonElement>('#routeUser2')!;
const routeSettingsButton =
  document.querySelector<HTMLButtonElement>('#routeSettings')!;
const routeReplaceHomeButton =
  document.querySelector<HTMLButtonElement>('#routeReplaceHome')!;

const readBrowserLocation = (): BrowserLocation => ({
  pathname: window.location.pathname,
  search: window.location.search,
  hash: window.location.hash,
});

const performNavigation = (command: NavigationCommand): void => {
  const url = routeToUrl(command.route);

  if (command.mode === 'replace') {
    window.history.replaceState(null, '', url);
    return;
  }

  window.history.pushState(null, '', url);
};

const formatRouteParams = (route: Route): string => {
  switch (route.type) {
    case 'user':
      return JSON.stringify({ id: route.id });
    case 'notFound':
      return JSON.stringify({ pathname: route.pathname });
    case 'home':
    case 'settings':
      return 'none';
  }
};

type User = {
  readonly id: number;
  readonly name: string;
  readonly username: string;
  readonly email: string;
};

const loadUser = (id: number): Observable<User> =>
  ajax.getJSON<User>(`https://jsonplaceholder.typicode.com/users/${id}`);

const formatUser = (user: User): string => JSON.stringify(user, null, 2);

const formatError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

// Pure route -> request intent projection. It owns which routes need which
// data; null means the current route needs no user request.
const routeToUserId = (route: Route): number | null =>
  route.type === 'user' ? route.id : null;

// Typed route data selects the JSX view. JSX owns structure only; the view
// lifetime ends when the next route mounts through bindRouteView.
const createRouteView = (route: Route): View<HTMLElement> =>
  createView(lifetime => {
    switch (route.type) {
      case 'home':
        return (
          <section>
            <strong>Home view</strong>
            <p>The typed home route selected this JSX view.</p>
          </section>
        ) as HTMLElement;

      case 'user': {
        const statusElement = <code /> as HTMLElement;
        const errorElement = <code /> as HTMLElement;
        const resultElement = <pre class="http-result" /> as HTMLElement;

        const resultText$ = userLoadingState$.pipe(
          map(state => state.status === 'success' ? formatUser(state.value) : ''),
          distinctUntilChanged(),
        );

        const errorText$ = userLoadingState$.pipe(
          map(state => state.status === 'error' ? formatError(state.error) : 'none'),
          distinctUntilChanged(),
        );

        lifetime.add(bindText(statusElement, userRequestStatus$));
        lifetime.add(bindText(errorElement, errorText$));
        lifetime.add(bindText(resultElement, resultText$));

        return (
          <section>
            <strong>User view</strong>
            <p>
              Mounted for user id {route.id}. The route selection started this
              request; navigating away cancels it.
            </p>
            <p>status: {statusElement} · error: {errorElement}</p>
            {resultElement}
          </section>
        ) as HTMLElement;
      }

      case 'settings':
        return (
          <section>
            <strong>Settings view</strong>
            <p>The typed settings route selected this JSX view.</p>
          </section>
        ) as HTMLElement;

      case 'notFound':
        return (
          <section>
            <strong>Not found</strong>
            <p>No route matches {route.pathname}.</p>
          </section>
        ) as HTMLElement;
    }
  });

// Imperative application code can enter the router through this Subject.
const programmaticNavigation$ = new Subject<NavigationCommand>();

export const navigate = (
  route: Route,
  mode: NavigationMode = 'push',
): void => {
  programmaticNavigation$.next({ mode, route });
};

// DOM navigation sources remain ordinary RxJS fromEvent streams.
const buttonNavigation$ = merge(
  fromEvent(routeHomeButton, 'click').pipe(
    map((): NavigationCommand => ({
      mode: 'push',
      route: { type: 'home' },
    })),
  ),
  fromEvent(routeUser1Button, 'click').pipe(
    map((): NavigationCommand => ({
      mode: 'push',
      route: { type: 'user', id: 1 },
    })),
  ),
  fromEvent(routeUser2Button, 'click').pipe(
    map((): NavigationCommand => ({
      mode: 'push',
      route: { type: 'user', id: 2 },
    })),
  ),
  fromEvent(routeSettingsButton, 'click').pipe(
    map((): NavigationCommand => ({
      mode: 'push',
      route: { type: 'settings' },
    })),
  ),
  fromEvent(routeReplaceHomeButton, 'click').pipe(
    map((): NavigationCommand => ({
      mode: 'replace',
      route: { type: 'home' },
    })),
  ),
);

const navigationCommand$ = merge(
  buttonNavigation$,
  programmaticNavigation$,
);

// pushState/replaceState do not emit popstate, so committed application
// navigation is explicitly folded back into the location stream.
const applicationLocation$ = navigationCommand$.pipe(
  tap(performNavigation),
  map(readBrowserLocation),
);

const historyLocation$ = fromEvent<PopStateEvent>(window, 'popstate').pipe(
  map(readBrowserLocation),
);

const location$ = merge(
  of(readBrowserLocation()),
  historyLocation$,
  applicationLocation$,
).pipe(
  distinctUntilChanged(
    (left, right) => locationToUrl(left) === locationToUrl(right),
  ),
  shareLatest(),
);

export const route$ = location$.pipe(
  map(parseRoute),
  distinctUntilChanged(sameRoute),
  shareLatest(),
);

const currentUrl$ = location$.pipe(
  map(locationToUrl),
  distinctUntilChanged(),
);

const routeType$ = route$.pipe(
  map(route => route.type),
  distinctUntilChanged(),
);

const routeParams$ = route$.pipe(
  map(formatRouteParams),
  distinctUntilChanged(),
);

const routeNotFound$ = route$.pipe(
  map(route => route.type === 'notFound'),
  distinctUntilChanged(),
);

// ROUTER + HTTP: route selection drives request intent and cancellation.
// No new API is involved — Route$, a pure projection, switchMap, and
// LoadingState compose into route-driven data loading.
const userId$ = route$.pipe(
  map(routeToUserId),
  distinctUntilChanged(),
);

// switchMap makes navigation the cancellation policy: moving from user 1 to
// user 2 abandons the in-flight request, and leaving the user route entirely
// (null intent) cancels it and resets the state to idle.
const userLoadingState$ = userId$.pipe(
  switchMap(id =>
    id === null
      ? of(idle())
      : loadUser(id).pipe(
          map(success),
          catchError((error: unknown) => of(failure(error))),
          startWith(loading()),
        ),
  ),
  shareLatest<LoadingState<User>>(),
);

const userRequestStatus$ = userLoadingState$.pipe(
  map(state => state.status),
  distinctUntilChanged(),
);

const bindings = [
  bindText(routeUrlElement, currentUrl$),
  bindText(routeTypeElement, routeType$),
  bindText(routeParamsElement, routeParams$),
  bindAttribute(routerSection, 'data-route', routeType$),
  bindClass(routerSection, 'not-found', routeNotFound$),
  // Persistent subscriber: keeps the shared request lifecycle alive across
  // route view swaps, so cancellation stays a visible switchMap policy.
  bindText(routeRequestElement, userRequestStatus$),
  // route$ already applies distinctUntilChanged(sameRoute), so one view
  // mounts per navigation, not one per emission.
  bindRouteView(routeViewElement, route$, createRouteView),
];

const destroy = (): void => {
  bindings.forEach(subscription => subscription.unsubscribe());
  programmaticNavigation$.complete();
};

window.addEventListener('pagehide', destroy, { once: true });

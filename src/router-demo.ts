import {
  Subject,
  distinctUntilChanged,
  fromEvent,
  map,
  merge,
  of,
  tap,
} from 'rxjs';
import {
  bindAttribute,
  bindClass,
  bindText,
} from './bindings';
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

const routerSection = document.querySelector<HTMLElement>('#routerSection')!;
const routeUrlElement = document.querySelector<HTMLElement>('#routeUrl')!;
const routeTypeElement = document.querySelector<HTMLElement>('#routeType')!;
const routeParamsElement = document.querySelector<HTMLElement>('#routeParams')!;
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

const renderRoute = (route: Route): string => {
  switch (route.type) {
    case 'home':
      return 'Home view';
    case 'user':
      return `User view for id ${route.id}`;
    case 'settings':
      return 'Settings view';
    case 'notFound':
      return `Not found: ${route.pathname}`;
  }
};

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

const routeView$ = route$.pipe(
  map(renderRoute),
  distinctUntilChanged(),
);

const routeNotFound$ = route$.pipe(
  map(route => route.type === 'notFound'),
  distinctUntilChanged(),
);

const bindings = [
  bindText(routeUrlElement, currentUrl$),
  bindText(routeTypeElement, routeType$),
  bindText(routeParamsElement, routeParams$),
  bindText(routeViewElement, routeView$),
  bindAttribute(routerSection, 'data-route', routeType$),
  bindClass(routerSection, 'not-found', routeNotFound$),
];

const destroy = (): void => {
  bindings.forEach(subscription => subscription.unsubscribe());
  programmaticNavigation$.complete();
};

window.addEventListener('pagehide', destroy, { once: true });

export type BrowserLocation = {
  readonly pathname: string;
  readonly search: string;
  readonly hash: string;
};

export type Route =
  | { readonly type: 'home' }
  | { readonly type: 'user'; readonly id: number }
  | { readonly type: 'settings' }
  | { readonly type: 'notFound'; readonly pathname: string };

export type NavigationMode = 'push' | 'replace';

export type NavigationCommand = {
  readonly mode: NavigationMode;
  readonly route: Route;
};

const normalizePathname = (pathname: string): string => {
  if (pathname === '') return '/';
  if (pathname === '/') return '/';
  return pathname.replace(/\/+$/, '') || '/';
};

/** Pure URL -> typed route parser. */
export const parseRoute = (
  location: BrowserLocation,
): Route => {
  const pathname = normalizePathname(location.pathname);

  if (pathname === '/') {
    return { type: 'home' };
  }

  if (pathname === '/settings') {
    return { type: 'settings' };
  }

  const userMatch = /^\/users\/(\d+)$/.exec(pathname);

  if (userMatch) {
    const id = Number(userMatch[1]);

    if (Number.isSafeInteger(id) && id > 0) {
      return { type: 'user', id };
    }
  }

  return {
    type: 'notFound',
    pathname,
  };
};

/** Pure typed route -> URL serializer. */
export const routeToUrl = (route: Route): string => {
  switch (route.type) {
    case 'home':
      return '/';
    case 'user':
      return `/users/${route.id}`;
    case 'settings':
      return '/settings';
    case 'notFound':
      return route.pathname;
  }
};

export const locationToUrl = (
  location: BrowserLocation,
): string => `${location.pathname}${location.search}${location.hash}`;

export const sameRoute = (left: Route, right: Route): boolean => {
  if (left.type !== right.type) return false;

  switch (left.type) {
    case 'home':
    case 'settings':
      return true;
    case 'user':
      return right.type === 'user' && left.id === right.id;
    case 'notFound':
      return right.type === 'notFound' && left.pathname === right.pathname;
  }
};

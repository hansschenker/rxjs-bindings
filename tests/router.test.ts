import { describe, expect, it } from 'vitest';
import {
  locationToUrl,
  parseRoute,
  routeToUrl,
  sameRoute,
  type BrowserLocation,
  type Route,
} from '../src/router';

const at = (pathname: string): BrowserLocation => ({
  pathname,
  search: '',
  hash: '',
});

describe('parseRoute', () => {
  it('parses the root pathname as home', () => {
    expect(parseRoute(at('/'))).toEqual({ type: 'home' });
  });

  it('parses an empty pathname as home', () => {
    expect(parseRoute(at(''))).toEqual({ type: 'home' });
  });

  it('parses only-slashes pathnames as home', () => {
    expect(parseRoute(at('///'))).toEqual({ type: 'home' });
  });

  it('parses /settings as settings', () => {
    expect(parseRoute(at('/settings'))).toEqual({ type: 'settings' });
  });

  it('normalizes trailing slashes before matching', () => {
    expect(parseRoute(at('/settings/'))).toEqual({ type: 'settings' });
    expect(parseRoute(at('/users/7///'))).toEqual({ type: 'user', id: 7 });
  });

  it('parses /users/:id with a typed numeric id', () => {
    expect(parseRoute(at('/users/42'))).toEqual({ type: 'user', id: 42 });
  });

  it('rejects a zero user id as notFound', () => {
    expect(parseRoute(at('/users/0'))).toEqual({
      type: 'notFound',
      pathname: '/users/0',
    });
  });

  it('rejects an unsafe-integer user id as notFound', () => {
    const pathname = '/users/99999999999999999999';
    expect(parseRoute(at(pathname))).toEqual({ type: 'notFound', pathname });
  });

  it('rejects a non-numeric user id as notFound', () => {
    expect(parseRoute(at('/users/abc'))).toEqual({
      type: 'notFound',
      pathname: '/users/abc',
    });
  });

  it('parses unknown pathnames as notFound carrying the pathname', () => {
    expect(parseRoute(at('/nowhere'))).toEqual({
      type: 'notFound',
      pathname: '/nowhere',
    });
  });
});

describe('routeToUrl', () => {
  it('serializes each route type', () => {
    expect(routeToUrl({ type: 'home' })).toBe('/');
    expect(routeToUrl({ type: 'settings' })).toBe('/settings');
    expect(routeToUrl({ type: 'user', id: 3 })).toBe('/users/3');
    expect(routeToUrl({ type: 'notFound', pathname: '/lost' })).toBe('/lost');
  });

  it('round-trips through parseRoute', () => {
    const routes: readonly Route[] = [
      { type: 'home' },
      { type: 'settings' },
      { type: 'user', id: 12 },
    ];

    for (const route of routes) {
      expect(parseRoute(at(routeToUrl(route)))).toEqual(route);
    }
  });
});

describe('locationToUrl', () => {
  it('concatenates pathname, search, and hash', () => {
    expect(
      locationToUrl({ pathname: '/a', search: '?b=1', hash: '#c' }),
    ).toBe('/a?b=1#c');
  });
});

describe('sameRoute', () => {
  it('treats parameterless routes of the same type as equal', () => {
    expect(sameRoute({ type: 'home' }, { type: 'home' })).toBe(true);
    expect(sameRoute({ type: 'settings' }, { type: 'settings' })).toBe(true);
  });

  it('distinguishes route types', () => {
    expect(sameRoute({ type: 'home' }, { type: 'settings' })).toBe(false);
  });

  it('compares user routes by id', () => {
    expect(sameRoute({ type: 'user', id: 1 }, { type: 'user', id: 1 })).toBe(true);
    expect(sameRoute({ type: 'user', id: 1 }, { type: 'user', id: 2 })).toBe(false);
  });

  it('compares notFound routes by pathname', () => {
    expect(sameRoute(
      { type: 'notFound', pathname: '/a' },
      { type: 'notFound', pathname: '/a' },
    )).toBe(true);
    expect(sameRoute(
      { type: 'notFound', pathname: '/a' },
      { type: 'notFound', pathname: '/b' },
    )).toBe(false);
  });
});

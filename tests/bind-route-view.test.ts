import { describe, expect, it } from 'vitest';
import { Subject } from 'rxjs';
import { bindRouteView } from '../src/bind-route-view';
import { createView, type View } from '../src/view';

describe('bindRouteView', () => {
  const setup = () => {
    const host = document.createElement('div');
    const route$ = new Subject<string>();
    const destroyed: string[] = [];

    const createRouteView = (route: string): View<HTMLElement> =>
      createView(lifetime => {
        lifetime.add(() => destroyed.push(route));
        const node = document.createElement('section');
        node.textContent = route;
        return node;
      });

    const subscription = bindRouteView(host, route$, createRouteView);
    return { host, route$, destroyed, subscription };
  };

  it('mounts one view per route emission', () => {
    const { host, route$ } = setup();

    route$.next('home');

    expect(host.childElementCount).toBe(1);
    expect(host.textContent).toBe('home');
  });

  it('replaces the previous view and tears it down on the next route', () => {
    const { host, route$, destroyed } = setup();

    route$.next('home');
    route$.next('settings');

    expect(host.childElementCount).toBe(1);
    expect(host.textContent).toBe('settings');
    expect(destroyed).toEqual(['home']);
  });

  it('tears down the active view when the binding is unsubscribed', () => {
    const { host, route$, destroyed, subscription } = setup();

    route$.next('home');
    subscription.unsubscribe();

    expect(host.childElementCount).toBe(0);
    expect(destroyed).toEqual(['home']);
  });
});

import { Subscription, type Observable } from 'rxjs';
import type { View } from './view';

/**
 * Structural binding: each route emission replaces the mounted route view.
 *
 * The previous view's lifetime is unsubscribed before the next view mounts,
 * so route-scoped bindings, event streams, requests, and child views end
 * exactly when their route ends. The host element is dedicated to this
 * binding.
 *
 * Route identity policy stays upstream where it remains visible RxJS: a
 * route$ built with distinctUntilChanged(sameRoute) mounts one view per
 * navigation, not one per emission.
 */
export const bindRouteView = <R, E extends Element>(
  host: Element,
  route$: Observable<R>,
  createRouteView: (route: R) => View<E>,
): Subscription => {
  const lifetime = new Subscription();
  let active: View<E> | null = null;

  const unmount = (): void => {
    active?.lifetime.unsubscribe();
    active = null;
  };

  lifetime.add(
    route$.subscribe(route => {
      unmount();
      active = createRouteView(route);
      host.append(active.node);
    }),
  );

  lifetime.add(unmount);

  return lifetime;
};

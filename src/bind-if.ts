import { Subscription, type Observable } from 'rxjs';
import type { View } from './view';

/**
 * Structural binding: mounts one view while condition$ is true and fully
 * tears it down while condition$ is false.
 *
 * Unlike a CSS visibility binding, a false condition unsubscribes the branch
 * view lifetime, so its bindings, event streams, and child views stop and its
 * DOM node is removed. The host element is dedicated to this binding; the
 * branch view is appended to it while mounted.
 *
 * Duplicate condition emissions are safe: an already mounted view stays
 * mounted. Distinct-emission policy still belongs upstream where it remains
 * visible RxJS.
 */
export const bindIf = <E extends Element>(
  host: Element,
  condition$: Observable<boolean>,
  createBranchView: () => View<E>,
): Subscription => {
  const lifetime = new Subscription();
  let active: View<E> | null = null;

  const unmount = (): void => {
    active?.lifetime.unsubscribe();
    active = null;
  };

  lifetime.add(
    condition$.subscribe(condition => {
      if (!condition) {
        unmount();
        return;
      }

      if (active === null) {
        active = createBranchView();
        host.append(active.node);
      }
    }),
  );

  lifetime.add(unmount);

  return lifetime;
};

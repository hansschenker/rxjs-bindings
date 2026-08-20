import { Subscription } from 'rxjs';

export type View<T extends Element = Element> = {
  readonly node: T;
  readonly lifetime: Subscription;
};

/**
 * Creates one DOM view and one explicit RxJS lifetime scope.
 *
 * The builder owns structure. Call lifetime.add(...) for every binding,
 * subscription, child view, or teardown that belongs to this view.
 */
export const createView = <T extends Element>(
  build: (lifetime: Subscription) => T,
): View<T> => {
  const lifetime = new Subscription();

  try {
    const node = build(lifetime);

    lifetime.add(() => {
      node.remove();
    });

    return { node, lifetime };
  } catch (error) {
    lifetime.unsubscribe();
    throw error;
  }
};

/** Mount a view without introducing another lifecycle abstraction. */
export const mountView = <T extends Element>(
  host: Element,
  view: View<T>,
): Subscription => {
  host.append(view.node);
  return view.lifetime;
};

/** Replace the root host contents with one application view. */
export const mountApp = <T extends Element>(
  host: Element,
  view: View<T>,
): Subscription => {
  host.replaceChildren(view.node);
  return view.lifetime;
};

import { Subscription, type Observable } from 'rxjs';
import type { View } from '../src/view';

type Entry<T, E extends Element> = {
  readonly item: T;
  readonly view: View<E>;
};

/**
 * Sample-local structural binding used to prove CRUDL list rendering.
 *
 * It deliberately lives in sample/ rather than the framework core while the
 * final bindList() API is still being designed.
 */
export const bindKeyedList = <T, K, E extends Element>(
  host: Element,
  items$: Observable<readonly T[]>,
  keyOf: (item: T) => K,
  createItemView: (item: T) => View<E>,
  sameItem: (left: T, right: T) => boolean = Object.is,
): Subscription => {
  const lifetime = new Subscription();
  const entries = new Map<K, Entry<T, E>>();

  lifetime.add(
    items$.subscribe(items => {
      const nextKeys = new Set<K>();

      for (const item of items) {
        const key = keyOf(item);

        if (nextKeys.has(key)) {
          throw new Error(`Duplicate list key: ${String(key)}`);
        }

        nextKeys.add(key);
        const previous = entries.get(key);

        if (previous !== undefined && sameItem(previous.item, item)) {
          continue;
        }

        previous?.view.lifetime.unsubscribe();
        entries.set(key, {
          item,
          view: createItemView(item),
        });
      }

      for (const [key, entry] of entries) {
        if (!nextKeys.has(key)) {
          entry.view.lifetime.unsubscribe();
          entries.delete(key);
        }
      }

      for (const item of items) {
        const entry = entries.get(keyOf(item));
        if (entry !== undefined) {
          host.append(entry.view.node);
        }
      }
    }),
  );

  lifetime.add(() => {
    for (const entry of entries.values()) {
      entry.view.lifetime.unsubscribe();
    }
    entries.clear();
  });

  return lifetime;
};

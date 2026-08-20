import { BehaviorSubject, Subscription, type Observable } from 'rxjs';
import type { View } from './view';

type Entry<T, E extends Element> = {
  readonly item$: BehaviorSubject<T>;
  readonly view: View<E>;
};

/**
 * Structural binding: reconciles a keyed list of views against items$.
 *
 * Each key gets one item view for its whole lifetime. The view receives its
 * item as a remembered Observable, so an item change updates the existing
 * view in place through ordinary bindings instead of recreating DOM. This
 * preserves focus, selection, and other transient DOM state inside item
 * views while the list changes around them.
 *
 * The per-key BehaviorSubject is the imperative-to-reactive bridge from list
 * emissions into one item's stream; list state itself stays owned by the
 * upstream items$ pipeline. sameItem decides whether an emission carries a
 * genuine item change (Object.is by default).
 *
 * DOM order is applied with minimal moves: nodes already in position are not
 * touched. The host element is dedicated to this binding.
 */
export const bindList = <T, K, E extends Element>(
  host: Element,
  items$: Observable<readonly T[]>,
  keyOf: (item: T) => K,
  createItemView: (item$: Observable<T>, key: K) => View<E>,
  sameItem: (left: T, right: T) => boolean = Object.is,
): Subscription => {
  const lifetime = new Subscription();
  const entries = new Map<K, Entry<T, E>>();

  const destroyEntry = (entry: Entry<T, E>): void => {
    entry.view.lifetime.unsubscribe();
    entry.item$.complete();
  };

  lifetime.add(
    items$.subscribe(items => {
      const nextKeys = new Set<K>();

      // Create views for new keys; push in-place updates to existing views.
      for (const item of items) {
        const key = keyOf(item);

        if (nextKeys.has(key)) {
          throw new Error(`Duplicate list key: ${String(key)}`);
        }

        nextKeys.add(key);
        const existing = entries.get(key);

        if (existing === undefined) {
          const item$ = new BehaviorSubject(item);
          entries.set(key, {
            item$,
            view: createItemView(item$, key),
          });
          continue;
        }

        if (!sameItem(existing.item$.getValue(), item)) {
          existing.item$.next(item);
        }
      }

      // Tear down views whose keys left the list. Their teardown removes
      // their nodes, so the order walk below only sees surviving nodes.
      for (const [key, entry] of entries) {
        if (!nextKeys.has(key)) {
          destroyEntry(entry);
          entries.delete(key);
        }
      }

      // Apply list order. A node already at the cursor stays untouched, so
      // an unchanged order performs zero DOM moves.
      let cursor: ChildNode | null = host.firstChild;

      for (const item of items) {
        const entry = entries.get(keyOf(item));
        if (entry === undefined) continue;

        if (entry.view.node === cursor) {
          cursor = cursor.nextSibling;
          continue;
        }

        host.insertBefore(entry.view.node, cursor);
      }
    }),
  );

  lifetime.add(() => {
    entries.forEach(destroyEntry);
    entries.clear();
  });

  return lifetime;
};

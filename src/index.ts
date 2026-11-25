import { Observable, ReplaySubject, takeUntil } from 'rxjs';
import type { Observer, Subscribable, Subscription } from 'rxjs';

/** Bind next/error/complete notifications to a consumer's lifecycle. */
export function bindObserver<T>(
  source: Subscribable<T>,
  observer: Partial<Observer<T>>,
  destroy$: Observable<unknown>,
): Subscription {
  // Plain Subscribable objects need not implement Symbol.observable.
  const source$ = source instanceof Observable
    ? source
    : new Observable<T>(subscriber => source.subscribe(subscriber));

  return source$.pipe(takeUntil(destroy$)).subscribe(observer);
}

/** The foundational one-way binding primitive. */
export function bindSubscribable<T>(
  source: Subscribable<T>,
  consume: (value: T) => void,
  destroy$: Observable<unknown>,
): Subscription {
  return bindObserver(source, { next: consume }, destroy$);
}

/** Assign emissions to a writable object property. */
export function bindProperty<T extends object, K extends keyof T>(
  source: Subscribable<T[K]>,
  target: T,
  key: K,
  destroy$: Observable<unknown>,
): Subscription {
  return bindSubscribable(source, value => { target[key] = value; }, destroy$);
}

export interface StateSink<T> {
  setState(value: T): void;
}

/** Forward emissions to a state container; does not prescribe merge semantics. */
export function bindState<T>(
  source: Subscribable<T>,
  state: StateSink<T>,
  destroy$: Observable<unknown>,
): Subscription {
  return bindSubscribable(source, value => state.setState(value), destroy$);
}

export interface BindingScope {
  readonly destroy$: Observable<void>;
  destroy(): void;
}

/** One terminal lifecycle per consumer. Late bindings also see destruction. */
export function createBindingScope(): BindingScope {
  const destroyed$ = new ReplaySubject<void>(1);
  let destroyed = false;

  return {
    destroy$: destroyed$.asObservable(),
    destroy() {
      if (destroyed) return;
      destroyed = true;
      destroyed$.next();
      destroyed$.complete();
    },
  };
}

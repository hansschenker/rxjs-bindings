import type { Observable, Subscription } from 'rxjs';

/**
 * Connects an Observable value stream to an element's textContent.
 *
 * This is an RxJS -> DOM sink. The caller owns the returned Subscription
 * and therefore owns teardown/cancellation.
 */
export const bindText = (
  element: Element,
  value$: Observable<unknown>,
): Subscription =>
  value$.subscribe(value => {
    element.textContent = value == null ? '' : String(value);
  });

/**
 * Connects an Observable value stream to a writable DOM property.
 *
 * This is an RxJS -> DOM sink. The caller owns the returned Subscription
 * and therefore owns teardown/cancellation.
 */
export const bindProperty = <
  E extends HTMLElement,
  K extends keyof E,
>(
  element: E,
  property: K,
  value$: Observable<E[K]>,
): Subscription =>
  value$.subscribe(value => {
    element[property] = value;
  });

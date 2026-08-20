import type { Observable, Subscription } from 'rxjs';

export type AttributeValue = string | number | boolean | null | undefined;
export type StyleValue = string | number | null | undefined;

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

/**
 * Connects an Observable value stream to a DOM attribute.
 *
 * null and undefined remove the attribute. All other values are stringified.
 */
export const bindAttribute = (
  element: Element,
  attribute: string,
  value$: Observable<AttributeValue>,
): Subscription =>
  value$.subscribe(value => {
    if (value == null) {
      element.removeAttribute(attribute);
      return;
    }

    element.setAttribute(attribute, String(value));
  });

/**
 * Connects an Observable<boolean> to one class token.
 *
 * true adds the class; false removes it.
 */
export const bindClass = (
  element: Element,
  className: string,
  enabled$: Observable<boolean>,
): Subscription =>
  enabled$.subscribe(enabled => {
    element.classList.toggle(className, enabled);
  });

/**
 * Connects an Observable value stream to one inline CSS property.
 *
 * null and undefined remove the property. String and number values are applied
 * exactly as CSS text; unit policy stays in the upstream stream transformation.
 */
export const bindStyle = (
  element: HTMLElement,
  property: string,
  value$: Observable<StyleValue>,
): Subscription =>
  value$.subscribe(value => {
    if (value == null) {
      element.style.removeProperty(property);
      return;
    }

    element.style.setProperty(property, String(value));
  });

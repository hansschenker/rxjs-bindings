import { fromEvent } from 'rxjs';
import type { Observable, Subscribable, Subscription } from 'rxjs';
import { bindSubscribable } from './index.js';

export type TextValue = string | number | boolean | null | undefined;
export type AttributeValue = string | number | null | undefined;

/** Write text, never HTML. Nullish values clear the text. */
export function bindText(
  source: Subscribable<TextValue>,
  target: Node,
  destroy$: Observable<unknown>,
): Subscription {
  return bindSubscribable(source, value => {
    target.textContent = value == null ? '' : String(value);
  }, destroy$);
}

/** Null or undefined removes an attribute. Boolean attributes need explicit presence/absence. */
export function bindAttribute(
  source: Subscribable<AttributeValue>,
  target: Element,
  name: string,
  destroy$: Observable<unknown>,
): Subscription {
  return bindSubscribable(source, value => {
    if (value == null) target.removeAttribute(name);
    else target.setAttribute(name, String(value));
  }, destroy$);
}

/** Use CSS property names (e.g. 'background-color', '--progress'). */
export function bindStyle(
  source: Subscribable<string | null | undefined>,
  target: HTMLElement | SVGElement,
  property: string,
  destroy$: Observable<unknown>,
): Subscription {
  return bindSubscribable(source, value => {
    if (value == null) target.style.removeProperty(property);
    else target.style.setProperty(property, value);
  }, destroy$);
}

/** Toggle one CSS class; className must be a single valid token. */
export function bindClass(
  source: Subscribable<boolean>,
  target: Element,
  className: string,
  destroy$: Observable<unknown>,
): Subscription {
  return bindSubscribable(source, value => {
    target.classList.toggle(className, value);
  }, destroy$);
}

/** Attach a native event listener with lifecycle-bound cleanup. */
export function bindEvent(
  target: EventTarget,
  eventName: string,
  consume: (event: Event) => void,
  destroy$: Observable<unknown>,
  options?: { capture?: boolean; passive?: boolean },
): Subscription {
  return bindSubscribable(
    fromEvent<Event>(target, eventName, options),
    consume,
    destroy$,
  );
}

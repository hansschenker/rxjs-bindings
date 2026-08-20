import { describe, expect, it } from 'vitest';
import { Subject } from 'rxjs';
import {
  bindAttribute,
  bindClass,
  bindProperty,
  bindStyle,
  bindText,
  type AttributeValue,
  type StyleValue,
} from '../src/bindings';

describe('bindText', () => {
  it('writes emitted values to textContent as strings', () => {
    const element = document.createElement('span');
    const value$ = new Subject<unknown>();
    bindText(element, value$);

    value$.next('hello');
    expect(element.textContent).toBe('hello');

    value$.next(42);
    expect(element.textContent).toBe('42');
  });

  it('renders null and undefined as empty text', () => {
    const element = document.createElement('span');
    const value$ = new Subject<unknown>();
    bindText(element, value$);

    value$.next('something');
    value$.next(null);
    expect(element.textContent).toBe('');
  });

  it('stops updating after unsubscribe', () => {
    const element = document.createElement('span');
    const value$ = new Subject<unknown>();
    const subscription = bindText(element, value$);

    value$.next('kept');
    subscription.unsubscribe();
    value$.next('ignored');

    expect(element.textContent).toBe('kept');
  });
});

describe('bindProperty', () => {
  it('writes emitted values to the DOM property', () => {
    const input = document.createElement('input');
    const value$ = new Subject<string>();
    bindProperty(input, 'value', value$);

    value$.next('typed');
    expect(input.value).toBe('typed');
  });

  it('supports boolean properties', () => {
    const button = document.createElement('button');
    const disabled$ = new Subject<boolean>();
    bindProperty(button, 'disabled', disabled$);

    disabled$.next(true);
    expect(button.disabled).toBe(true);

    disabled$.next(false);
    expect(button.disabled).toBe(false);
  });
});

describe('bindAttribute', () => {
  it('sets stringified values and removes on null or undefined', () => {
    const element = document.createElement('div');
    const value$ = new Subject<AttributeValue>();
    bindAttribute(element, 'aria-busy', value$);

    value$.next(true);
    expect(element.getAttribute('aria-busy')).toBe('true');

    value$.next(3);
    expect(element.getAttribute('aria-busy')).toBe('3');

    value$.next(null);
    expect(element.hasAttribute('aria-busy')).toBe(false);

    value$.next('again');
    value$.next(undefined);
    expect(element.hasAttribute('aria-busy')).toBe(false);
  });
});

describe('bindClass', () => {
  it('toggles one class token from boolean emissions', () => {
    const element = document.createElement('div');
    const enabled$ = new Subject<boolean>();
    bindClass(element, 'active', enabled$);

    enabled$.next(true);
    expect(element.classList.contains('active')).toBe(true);

    enabled$.next(false);
    expect(element.classList.contains('active')).toBe(false);
  });
});

describe('bindStyle', () => {
  it('sets one inline property and removes on null or undefined', () => {
    const element = document.createElement('div');
    const value$ = new Subject<StyleValue>();
    bindStyle(element, 'font-size', value$);

    value$.next('1.5rem');
    expect(element.style.getPropertyValue('font-size')).toBe('1.5rem');

    value$.next(null);
    expect(element.style.getPropertyValue('font-size')).toBe('');
  });
});

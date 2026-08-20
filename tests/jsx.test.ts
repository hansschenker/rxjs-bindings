import { describe, expect, it } from 'vitest';
import { Fragment, jsx, type Component } from '../src/jsx';

describe('jsx factory', () => {
  it('creates intrinsic elements with text children', () => {
    const element = jsx('button', { type: 'button' }, 'Click');

    expect(element).toBeInstanceOf(HTMLButtonElement);
    expect(element.textContent).toBe('Click');
    expect((element as HTMLButtonElement).type).toBe('button');
  });

  it('maps className to the class attribute', () => {
    const element = jsx('div', { className: 'primary' });
    expect(element.getAttribute('class')).toBe('primary');
  });

  it('sets aria- and data- props as attributes', () => {
    const element = jsx('div', { 'aria-label': 'panel', 'data-id': '7' });

    expect(element.getAttribute('aria-label')).toBe('panel');
    expect(element.getAttribute('data-id')).toBe('7');
  });

  it('assigns known properties directly', () => {
    const input = jsx('input', { value: 'typed' }) as HTMLInputElement;
    expect(input.value).toBe('typed');
  });

  it('assigns boolean element properties', () => {
    const button = jsx('button', { disabled: true }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it('toggles boolean attributes unknown to the element', () => {
    expect(jsx('div', { foo: true }).hasAttribute('foo')).toBe(true);
    expect(jsx('div', { foo: false }).hasAttribute('foo')).toBe(false);
  });

  it('sets hyphenated props as attributes', () => {
    const element = jsx('div', { 'x-custom': 5 });
    expect(element.getAttribute('x-custom')).toBe('5');
  });

  it('skips null and undefined prop values', () => {
    const element = jsx('div', { title: null, id: undefined });

    expect(element.hasAttribute('title')).toBe(false);
    expect(element.hasAttribute('id')).toBe(false);
  });

  it('applies style strings and style objects', () => {
    const fromString = jsx('div', { style: 'color: blue' }) as HTMLElement;
    const fromObject = jsx('div', { style: { color: 'red' } }) as HTMLElement;

    expect(fromString.style.color).toBe('blue');
    expect(fromObject.style.color).toBe('red');
  });

  it('flattens array children and skips null, undefined, and booleans', () => {
    const list = jsx('ul', null, [
      jsx('li', null, 'a'),
      null,
      false,
      undefined,
      [jsx('li', null, 'b')],
    ]);

    expect(list.children).toHaveLength(2);
    expect(list.textContent).toBe('ab');
  });

  it('appends existing DOM nodes as children', () => {
    const child = document.createElement('span');
    const parent = jsx('div', null, child);

    expect(child.parentElement).toBe(parent);
  });

  it('throws on JSX event props', () => {
    expect(() => jsx('button', { onclick: () => undefined }))
      .toThrowError(/intentionally unsupported/);
  });

  it('throws on unsupported reactive-looking children', () => {
    expect(() => jsx('div', null, {} as never))
      .toThrowError(/Unsupported JSX child/);
  });

  it('calls function components with props and children', () => {
    const Label: Component<{ readonly text: string }> = ({ text, children = [] }) =>
      jsx('span', null, text, ...children);

    const node = jsx(Label, { text: 'hi ' }, 'there');
    expect(node.textContent).toBe('hi there');
  });

  it('creates fragments that flatten into a parent', () => {
    const fragment = jsx(Fragment, null, jsx('i', null), 'text');

    expect(fragment).toBeInstanceOf(DocumentFragment);
    expect(fragment.childNodes).toHaveLength(2);

    const host = document.createElement('div');
    host.append(fragment);
    expect(host.childNodes).toHaveLength(2);
  });
});

export type JSXPrimitive = string | number | bigint;

export type JSXChild =
  | Node
  | JSXPrimitive
  | boolean
  | null
  | undefined
  | readonly JSXChild[];

export type JSXChildren = readonly JSXChild[];

export type Component<P extends object = {}> = (
  props: P & { readonly children?: JSXChildren },
) => Node;

export type DOMProps = Readonly<Record<string, unknown>> & {
  readonly children?: JSXChild;
};

const isEventProp = (name: string): boolean => /^on/i.test(name);

const appendChild = (parent: Node, child: JSXChild): void => {
  if (child === null || child === undefined || typeof child === 'boolean') {
    return;
  }

  if (Array.isArray(child)) {
    child.forEach(value => appendChild(parent, value));
    return;
  }

  if (child instanceof Node) {
    parent.appendChild(child);
    return;
  }

  if (
    typeof child === 'string'
    || typeof child === 'number'
    || typeof child === 'bigint'
  ) {
    parent.appendChild(document.createTextNode(String(child)));
    return;
  }

  throw new TypeError(
    'Unsupported JSX child. Reactive values stay explicit through RxJS bindings.',
  );
};

const applyStyle = (
  element: HTMLElement,
  value: unknown,
): void => {
  if (typeof value === 'string') {
    element.style.cssText = value;
    return;
  }

  if (value !== null && typeof value === 'object') {
    Object.assign(element.style, value);
    return;
  }

  throw new TypeError('JSX style must be a string or a style object.');
};

const applyProp = (
  element: Element,
  name: string,
  value: unknown,
): void => {
  if (name === 'children' || name === 'key' || value === null || value === undefined) {
    return;
  }

  if (isEventProp(name)) {
    throw new TypeError(
      `JSX event prop "${name}" is intentionally unsupported; use RxJS fromEvent().`,
    );
  }

  if (name === 'className') {
    element.setAttribute('class', String(value));
    return;
  }

  if (name === 'style' && element instanceof HTMLElement) {
    applyStyle(element, value);
    return;
  }

  if (name.startsWith('aria-') || name.startsWith('data-')) {
    element.setAttribute(name, String(value));
    return;
  }

  if (typeof value === 'boolean') {
    if (name in element) {
      Reflect.set(element, name, value);
      return;
    }

    element.toggleAttribute(name, value);
    return;
  }

  if (!name.includes('-') && name in element) {
    Reflect.set(element, name, value);
    return;
  }

  element.setAttribute(name, String(value));
};

const createElement = (
  tagName: string,
  props: DOMProps | null,
  children: JSXChildren,
): Element => {
  const element = document.createElement(tagName);

  if (props !== null) {
    Object.entries(props).forEach(([name, value]) => {
      applyProp(element, name, value);
    });
  }

  children.forEach(child => appendChild(element, child));

  return element;
};

/**
 * TypeScript's classic JSX factory for rxjs-bindings.
 *
 * JSX owns static DOM structure only. Observable values and DOM events remain
 * explicit through RxJS pipelines and the binding/source APIs.
 */
export function jsx(
  type: string,
  props: DOMProps | null,
  ...children: JSXChildren
): Element;
export function jsx<P extends object>(
  type: Component<P>,
  props: P | null,
  ...children: JSXChildren
): Node;
export function jsx<P extends object>(
  type: string | Component<P>,
  props: P | DOMProps | null,
  ...children: JSXChildren
): Node {
  if (typeof type === 'function') {
    return type({
      ...(props ?? {}),
      children,
    } as P & { readonly children?: JSXChildren });
  }

  return createElement(type, props as DOMProps | null, children);
}

export const Fragment: Component = ({ children = [] }) => {
  const fragment = document.createDocumentFragment();
  children.forEach(child => appendChild(fragment, child));
  return fragment;
};

/**
 * Factory-scoped JSX namespace. TypeScript resolves JSX types through the
 * configured jsxFactory entity ("jsx.JSX" before any global JSX), so the
 * library does not install a global JSX namespace that could collide with
 * other JSX runtimes in a consuming application.
 */
export declare namespace jsx {
  export namespace JSX {
    export type Element = Node;

    export interface ElementChildrenAttribute {
      children: unknown;
    }

    export interface IntrinsicElements {
      [tagName: string]: DOMProps;
    }
  }
}

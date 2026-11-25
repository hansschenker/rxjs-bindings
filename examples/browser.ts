import { BehaviorSubject, interval, map } from 'rxjs';
import { bindSubscribable, createBindingScope } from '../src/index.js';
import { bindText, bindAttribute, bindStyle, bindClass, bindEvent } from '../src/dom.js';

// Use this custom element in any browser application with a TS bundler.
class RxBindingsDemo extends HTMLElement {
  private scope?: ReturnType<typeof createBindingScope>;

  connectedCallback(): void {
    if (this.scope) return;
    this.scope = createBindingScope();
    const { destroy$ } = this.scope;

    const value$ = new BehaviorSubject(0);
    const active$ = new BehaviorSubject(false);
    const status = document.createElement('span');
    const button = document.createElement('button');
    const progress = document.createElement('div');

    button.type = 'button';
    button.textContent = 'Increase';
    progress.style.height = '8px';
    progress.style.backgroundColor = 'royalblue';
    this.replaceChildren(status, button, progress);

    // 4. Text.
    bindText(value$.pipe(map(n => `Count: ${n}`)), status, destroy$);

    // 5. Attribute.
    bindAttribute(value$.pipe(map(n => `Count is ${n}`)), status,
      'aria-label', destroy$);

    // 6. CSS style.
    bindStyle(value$.pipe(map(n => `${Math.min(n * 10, 100)}%`)),
      progress, 'width', destroy$);

    // 7. CSS class.
    bindClass(active$, status, 'active', destroy$);

    // 8. DOM event, including listener cleanup.
    bindEvent(button, 'click', () => value$.next(value$.value + 1), destroy$);

    // Optional animation/heartbeat source bound to the same lifecycle.
    bindSubscribable(interval(1000), n => active$.next(n % 2 === 0), destroy$);
  }

  disconnectedCallback(): void {
    this.scope?.destroy();
    this.scope = undefined;
  }
}

customElements.define('rx-bindings-demo', RxBindingsDemo);

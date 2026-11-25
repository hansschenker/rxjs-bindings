import test from 'node:test';
import assert from 'node:assert/strict';
import { Observable, Subject, BehaviorSubject, of, throwError, share } from 'rxjs';
import { bindSubscribable, bindObserver, bindProperty, bindState, createBindingScope } from '../dist/index.js';
import { bindText, bindAttribute, bindStyle, bindClass, bindEvent } from '../dist/dom.js';

test('synchronous and generic Subscribable sources', () => {
  const scope = createBindingScope();
  const seen = [];
  let disposed = 0;
  const plain = { subscribe(observer) {
    observer.next(42);
    observer.complete();
    return { unsubscribe() { disposed++; } };
  }};
  const binding = bindSubscribable(plain, v => seen.push(v), scope.destroy$);
  assert.deepEqual(seen, [42]);
  assert.equal(binding.closed, true);
  assert.equal(disposed, 1);
});

test('completion and errors are delivered to observer', () => {
  const scope = createBindingScope();
  const seen = [];
  bindObserver(of(1, 2), {
    next: v => seen.push(v),
    complete: () => seen.push('done'),
  }, scope.destroy$);
  const error = new Error('failed');
  bindObserver(throwError(() => error), { error: e => seen.push(e) }, scope.destroy$);
  assert.deepEqual(seen, [1, 2, 'done', error]);
});

test('one lifecycle disposes multiple bindings; late binding never starts', () => {
  const scope = createBindingScope();
  const source = new Subject();
  const a = [], b = [];
  bindSubscribable(source, v => a.push(v), scope.destroy$);
  bindSubscribable(source, v => b.push(v), scope.destroy$);
  source.next(1);
  scope.destroy();
  scope.destroy();
  source.next(2);
  let starts = 0;
  const late = new Observable(() => { starts++; });
  const sub = bindSubscribable(late, () => {}, scope.destroy$);
  assert.equal(sub.closed, true);
  assert.equal(starts, 0);
  assert.deepEqual([a,b], [[1],[1]]);
});

test('manual unsubscribe only disposes its own binding', () => {
  const scope = createBindingScope();
  const source = new Subject();
  const a = [], b = [];
  const sub = bindSubscribable(source, v => a.push(v), scope.destroy$);
  bindSubscribable(source, v => b.push(v), scope.destroy$);
  sub.unsubscribe();
  source.next(1);
  assert.deepEqual([a,b], [[],[1]]);
  scope.destroy();
});

test('shared producer tears down after final binding', () => {
  let starts = 0, stops = 0;
  const shared$ = new Observable(() => { starts++; return () => { stops++; }; }).pipe(share());
  const a = createBindingScope(), b = createBindingScope();
  bindSubscribable(shared$, () => {}, a.destroy$);
  bindSubscribable(shared$, () => {}, b.destroy$);
  assert.equal(starts, 1);
  a.destroy();
  assert.equal(stops, 0);
  b.destroy();
  assert.equal(stops, 1);
});

test('property and state bindings deliver latest values', () => {
  const scope = createBindingScope();
  const values = new BehaviorSubject(1);
  const model = { count: 0 };
  const store = { state: 0, setState(v) { this.state = v; } };
  bindProperty(values, model, 'count', scope.destroy$);
  bindState(values, store, scope.destroy$);
  values.next(2);
  scope.destroy();
  values.next(3);
  assert.equal(model.count, 2);
  assert.equal(store.state, 2);
});

test('DOM adapters: text, attributes, styles and classes (test doubles)', () => {
  const scope = createBindingScope();
  const attrs = new Map(), styles = new Map(), classes = new Set();
  const el = {
    textContent: '',
    setAttribute: (k,v) => attrs.set(k,v),
    removeAttribute: k => attrs.delete(k),
    style: { setProperty: (k,v) => styles.set(k,v), removeProperty: k => styles.delete(k) },
    classList: { toggle: (k,v) => v ? classes.add(k) : classes.delete(k) },
  };
  const text = new BehaviorSubject('hello');
  const attr = new BehaviorSubject('label');
  const style = new BehaviorSubject('50%');
  const flag = new BehaviorSubject(true);
  bindText(text, el, scope.destroy$);
  bindAttribute(attr, el, 'aria-label', scope.destroy$);
  bindStyle(style, el, 'width', scope.destroy$);
  bindClass(flag, el, 'active', scope.destroy$);
  assert.equal(el.textContent, 'hello');
  assert.equal(attrs.get('aria-label'), 'label');
  assert.equal(styles.get('width'), '50%');
  assert.equal(classes.has('active'), true);
  attr.next(null); style.next(null); flag.next(false); text.next(null);
  assert.equal(attrs.size, 0);
  assert.equal(styles.size, 0);
  assert.equal(classes.size, 0);
  assert.equal(el.textContent, '');
  scope.destroy();
  text.next('ignored');
  assert.equal(el.textContent, '');
});

test('event binding removes native listener on disposal', () => {
  const scope = createBindingScope();
  const target = new EventTarget();
  let count = 0;
  bindEvent(target, 'click', () => count++, scope.destroy$);
  target.dispatchEvent(new Event('click'));
  scope.destroy();
  target.dispatchEvent(new Event('click'));
  assert.equal(count, 1);
});

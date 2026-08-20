import { describe, expect, it } from 'vitest';
import { Subject, config, type Observable } from 'rxjs';
import { bindList } from '../src/bind-list';
import { createView, type View } from '../src/view';

type Item = {
  readonly id: string;
  readonly label: string;
};

const item = (id: string, label: string): Item => ({ id, label });

const sameItem = (left: Item, right: Item): boolean =>
  left.id === right.id && left.label === right.label;

type Log = {
  readonly created: string[];
  readonly destroyed: string[];
  readonly streams: Map<string, Observable<Item>>;
};

const setup = () => {
  const host = document.createElement('ul');
  const items$ = new Subject<readonly Item[]>();
  const log: Log = { created: [], destroyed: [], streams: new Map() };

  const createItemView = (
    item$: Observable<Item>,
    key: string,
  ): View<HTMLLIElement> =>
    createView(lifetime => {
      log.created.push(key);
      log.streams.set(key, item$);
      lifetime.add(() => log.destroyed.push(key));

      const node = document.createElement('li');
      node.setAttribute('data-key', key);
      lifetime.add(item$.subscribe(current => {
        node.textContent = current.label;
      }));
      return node;
    });

  const subscription = bindList(
    host,
    items$,
    current => current.id,
    createItemView,
    sameItem,
  );

  return { host, items$, log, subscription };
};

const keysOf = (host: Element): readonly (string | null)[] =>
  Array.from(host.children).map(child => child.getAttribute('data-key'));

describe('bindList', () => {
  it('creates one keyed view per item in list order', () => {
    const { host, items$, log } = setup();

    items$.next([item('a', 'one'), item('b', 'two')]);

    expect(keysOf(host)).toEqual(['a', 'b']);
    expect(host.textContent).toBe('onetwo');
    expect(log.created).toEqual(['a', 'b']);
  });

  it('updates a changed item in place through its item stream', () => {
    const { host, items$, log } = setup();

    items$.next([item('a', 'one')]);
    const node = host.firstElementChild;

    items$.next([item('a', 'renamed')]);

    expect(log.created).toEqual(['a']);
    expect(host.firstElementChild).toBe(node);
    expect(host.textContent).toBe('renamed');
  });

  it('does not emit into item streams when sameItem reports no change', () => {
    const { items$, log } = setup();

    items$.next([item('a', 'one')]);

    const emissions: string[] = [];
    log.streams.get('a')!.subscribe(current => emissions.push(current.label));

    items$.next([item('a', 'one')]);

    expect(emissions).toEqual(['one']);
  });

  it('tears down views whose keys left the list', () => {
    const { host, items$, log } = setup();

    items$.next([item('a', 'one'), item('b', 'two')]);
    items$.next([item('b', 'two')]);

    expect(keysOf(host)).toEqual(['b']);
    expect(log.destroyed).toEqual(['a']);
  });

  it('reorders existing views with minimal DOM moves', () => {
    const { host, items$ } = setup();
    const a = item('a', 'one');
    const b = item('b', 'two');
    const c = item('c', 'three');

    items$.next([a, b, c]);

    let moves = 0;
    const originalInsertBefore = host.insertBefore.bind(host);
    host.insertBefore = (<T extends Node>(node: T, reference: Node | null): T => {
      moves += 1;
      return originalInsertBefore(node, reference);
    }) as typeof host.insertBefore;

    items$.next([a, b, c]);
    expect(moves).toBe(0);

    items$.next([c, a, b]);
    expect(moves).toBe(1);
    expect(keysOf(host)).toEqual(['c', 'a', 'b']);
  });

  it('keeps a moved view alive with its stream intact', () => {
    const { host, items$, log } = setup();

    items$.next([item('a', 'one'), item('b', 'two')]);
    items$.next([item('b', 'two'), item('a', 'still one')]);

    expect(log.created).toEqual(['a', 'b']);
    expect(log.destroyed).toEqual([]);
    expect(keysOf(host)).toEqual(['b', 'a']);
    expect(host.textContent).toBe('twostill one');
  });

  it('reports duplicate list keys as an error', async () => {
    const { items$ } = setup();
    const errors: unknown[] = [];
    config.onUnhandledError = error => errors.push(error);

    try {
      items$.next([item('a', 'one'), item('a', 'clone')]);
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(errors).toHaveLength(1);
      expect(String(errors[0])).toContain('Duplicate list key');
    } finally {
      config.onUnhandledError = null;
    }
  });

  it('tears down all views and completes item streams on unsubscribe', () => {
    const { host, items$, log, subscription } = setup();

    items$.next([item('a', 'one'), item('b', 'two')]);

    const completions: string[] = [];
    for (const [key, stream] of log.streams) {
      stream.subscribe({ complete: () => completions.push(key) });
    }

    subscription.unsubscribe();

    expect(host.childElementCount).toBe(0);
    expect(log.destroyed).toEqual(['a', 'b']);
    expect(completions).toEqual(['a', 'b']);
  });
});

import { describe, expect, it } from 'vitest';
import { Subject } from 'rxjs';
import { bindIf } from '../src/bind-if';
import { createView, type View } from '../src/view';

type Harness = {
  readonly host: HTMLElement;
  readonly condition$: Subject<boolean>;
  readonly log: { created: number; destroyed: number };
};

const setup = (): Harness & { readonly subscription: { unsubscribe(): void } } => {
  const host = document.createElement('div');
  const condition$ = new Subject<boolean>();
  const log = { created: 0, destroyed: 0 };

  const createBranchView = (): View<HTMLElement> =>
    createView(lifetime => {
      log.created += 1;
      lifetime.add(() => {
        log.destroyed += 1;
      });
      return document.createElement('section');
    });

  const subscription = bindIf(host, condition$, createBranchView);
  return { host, condition$, log, subscription };
};

describe('bindIf', () => {
  it('mounts the branch view when the condition turns true', () => {
    const { host, condition$, log } = setup();

    expect(host.childElementCount).toBe(0);
    condition$.next(true);

    expect(host.childElementCount).toBe(1);
    expect(log.created).toBe(1);
  });

  it('keeps the mounted view across duplicate true emissions', () => {
    const { host, condition$, log } = setup();

    condition$.next(true);
    condition$.next(true);

    expect(host.childElementCount).toBe(1);
    expect(log.created).toBe(1);
  });

  it('tears the branch view down when the condition turns false', () => {
    const { host, condition$, log } = setup();

    condition$.next(true);
    condition$.next(false);

    expect(host.childElementCount).toBe(0);
    expect(log.destroyed).toBe(1);
  });

  it('mounts a fresh view when the condition turns true again', () => {
    const { host, condition$, log } = setup();

    condition$.next(true);
    condition$.next(false);
    condition$.next(true);

    expect(host.childElementCount).toBe(1);
    expect(log.created).toBe(2);
    expect(log.destroyed).toBe(1);
  });

  it('tears down a mounted view when the binding is unsubscribed', () => {
    const { host, condition$, log, subscription } = setup();

    condition$.next(true);
    subscription.unsubscribe();

    expect(host.childElementCount).toBe(0);
    expect(log.destroyed).toBe(1);
  });
});

import { describe, expect, it } from 'vitest';
import { Observable, Subject } from 'rxjs';
import { shareLatest } from '../src/share-latest';

describe('shareLatest', () => {
  it('shares one upstream execution across subscribers', () => {
    let subscriptions = 0;
    const source$ = new Observable<number>(subscriber => {
      subscriptions += 1;
      subscriber.next(1);
    });

    const shared$ = source$.pipe(shareLatest());
    const values: number[] = [];
    const first = shared$.subscribe(value => values.push(value));
    const second = shared$.subscribe(value => values.push(value));

    expect(subscriptions).toBe(1);
    expect(values).toEqual([1, 1]);

    first.unsubscribe();
    second.unsubscribe();
  });

  it('replays only the latest value to a late subscriber', () => {
    const source$ = new Subject<number>();
    const shared$ = source$.pipe(shareLatest());
    const keepAlive = shared$.subscribe();

    source$.next(1);
    source$.next(2);

    const values: number[] = [];
    shared$.subscribe(value => values.push(value)).unsubscribe();

    expect(values).toEqual([2]);
    keepAlive.unsubscribe();
  });

  it('disconnects upstream when the last subscriber leaves', () => {
    let active = 0;
    const source$ = new Observable<number>(() => {
      active += 1;
      return () => {
        active -= 1;
      };
    });

    const shared$ = source$.pipe(shareLatest());
    const subscription = shared$.subscribe();
    expect(active).toBe(1);

    subscription.unsubscribe();
    expect(active).toBe(0);
  });
});

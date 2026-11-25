import { BehaviorSubject, interval, of, scan, Subject } from 'rxjs';
import {
  bindSubscribable, bindObserver, bindProperty, bindState, createBindingScope,
} from '../src/index.js';

const scope = createBindingScope();
const { destroy$ } = scope;

// 1. General callback binding.
bindSubscribable(interval(500), n => console.log('tick:', n), destroy$);

// 2. Full observer binding.
bindObserver(of('ready'), {
  next: value => console.log(value),
  error: error => console.error(error),
  complete: () => console.log('finished'),
}, destroy$);

// 3. Typed object property.
const model = { temperature: 0 };
const temperature$ = new BehaviorSubject(21);
bindProperty(temperature$, model, 'temperature', destroy$);
temperature$.next(23);
console.log('model:', model); // { temperature: 23 }

// 9. State container: a reducer/scan pipeline drives state snapshots.
const increment$ = new Subject<number>();
const total$ = increment$.pipe(scan((total, delta) => total + delta, 0));
const store = {
  state: 0,
  setState(value: number) {
    this.state = value;
    console.log('state:', value);
  },
};
bindState(total$, store, destroy$);
increment$.next(2);
increment$.next(3);

setTimeout(() => {
  scope.destroy(); // Disposes every binding in this scope.
  temperature$.next(99);
  console.log('after disposal:', model.temperature); // 23
}, 1600);

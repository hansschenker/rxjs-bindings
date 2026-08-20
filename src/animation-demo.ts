import {
  concatMap,
  distinctUntilChanged,
  fromEvent,
  map,
  startWith,
  switchMap,
} from 'rxjs';
import { bindStyle, bindText } from './bindings';
import {
  easeInOutCubic,
  lerp,
  progressOver,
} from './animation';
import { shareLatest } from './share-latest';

const animationDurationMs = 900;

const latestButton =
  document.querySelector<HTMLButtonElement>('#animationLatest')!;
const queueButton =
  document.querySelector<HTMLButtonElement>('#animationQueue')!;
const latestBox =
  document.querySelector<HTMLElement>('#animationLatestBox')!;
const queueBox =
  document.querySelector<HTMLElement>('#animationQueueBox')!;
const latestProgressElement =
  document.querySelector<HTMLElement>('#animationLatestProgress')!;
const queueProgressElement =
  document.querySelector<HTMLElement>('#animationQueueProgress')!;

const runAnimation = () =>
  progressOver(animationDurationMs).pipe(
    map(easeInOutCubic),
  );

// New clicks replace the currently running animation.
const latestProgress$ = fromEvent(latestButton, 'click').pipe(
  switchMap(runAnimation),
  startWith(0),
  shareLatest(),
);

// New clicks wait until all earlier animations complete.
const queuedProgress$ = fromEvent(queueButton, 'click').pipe(
  concatMap(runAnimation),
  startWith(0),
  shareLatest(),
);

const transformFromProgress = (progress: number): string => {
  const x = lerp(0, 220, progress);
  const scale = lerp(0.8, 1, progress);
  return `translateX(${x}px) scale(${scale})`;
};

const opacityFromProgress = (progress: number): string =>
  String(lerp(0.35, 1, progress));

const percentFromProgress = (progress: number): string =>
  `${Math.round(progress * 100)}%`;

const latestTransform$ = latestProgress$.pipe(
  map(transformFromProgress),
  distinctUntilChanged(),
);

const latestOpacity$ = latestProgress$.pipe(
  map(opacityFromProgress),
  distinctUntilChanged(),
);

const latestProgressText$ = latestProgress$.pipe(
  map(percentFromProgress),
  distinctUntilChanged(),
);

const queueTransform$ = queuedProgress$.pipe(
  map(transformFromProgress),
  distinctUntilChanged(),
);

const queueOpacity$ = queuedProgress$.pipe(
  map(opacityFromProgress),
  distinctUntilChanged(),
);

const queueProgressText$ = queuedProgress$.pipe(
  map(percentFromProgress),
  distinctUntilChanged(),
);

const bindings = [
  bindStyle(latestBox, 'transform', latestTransform$),
  bindStyle(latestBox, 'opacity', latestOpacity$),
  bindText(latestProgressElement, latestProgressText$),

  bindStyle(queueBox, 'transform', queueTransform$),
  bindStyle(queueBox, 'opacity', queueOpacity$),
  bindText(queueProgressElement, queueProgressText$),
];

const destroy = (): void => {
  bindings.forEach(subscription => subscription.unsubscribe());
};

window.addEventListener('pagehide', destroy, { once: true });

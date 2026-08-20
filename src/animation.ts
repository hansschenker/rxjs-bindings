import {
  animationFrames,
  map,
  type Observable,
  startWith,
  takeWhile,
} from 'rxjs';

export type Easing = (progress: number) => number;

/** Clamp a numeric animation progress value into the closed interval [0, 1]. */
export const clamp01 = (value: number): number =>
  Math.min(1, Math.max(0, value));

/** Linear interpolation between two numeric values. */
export const lerp = (
  from: number,
  to: number,
  progress: number,
): number => from + (to - from) * progress;

export const linear: Easing = progress => progress;

export const easeInOutCubic: Easing = progress =>
  progress < 0.5
    ? 4 * progress * progress * progress
    : 1 - Math.pow(-2 * progress + 2, 3) / 2;

/**
 * Emits normalized progress from 0 to 1 using the browser animation-frame clock.
 *
 * Time comes from RxJS animationFrames(). This helper only converts elapsed
 * frame time into normalized progress and completes after emitting 1.
 */
export const progressOver = (
  durationMs: number,
): Observable<number> => {
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    throw new RangeError('durationMs must be a finite number greater than 0');
  }

  return animationFrames().pipe(
    map(({ elapsed }) => clamp01(elapsed / durationMs)),
    startWith(0),
    takeWhile(progress => progress < 1, true),
  );
};

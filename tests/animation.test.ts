import { describe, expect, it } from 'vitest';
import {
  clamp01,
  easeInOutCubic,
  lerp,
  linear,
  progressOver,
} from '../src/animation';

describe('clamp01', () => {
  it('clamps into the closed interval [0, 1]', () => {
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(0)).toBe(0);
    expect(clamp01(0.5)).toBe(0.5);
    expect(clamp01(1)).toBe(1);
    expect(clamp01(2)).toBe(1);
  });
});

describe('lerp', () => {
  it('interpolates linearly between two values', () => {
    expect(lerp(0, 10, 0)).toBe(0);
    expect(lerp(0, 10, 0.5)).toBe(5);
    expect(lerp(0, 10, 1)).toBe(10);
    expect(lerp(10, -10, 0.5)).toBe(0);
  });
});

describe('easing functions', () => {
  it('linear is the identity', () => {
    expect(linear(0)).toBe(0);
    expect(linear(0.3)).toBe(0.3);
    expect(linear(1)).toBe(1);
  });

  it('easeInOutCubic fixes the endpoints and midpoint', () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(0.5)).toBe(0.5);
    expect(easeInOutCubic(1)).toBe(1);
  });

  it('easeInOutCubic is symmetric around the midpoint', () => {
    expect(easeInOutCubic(0.2) + easeInOutCubic(0.8)).toBeCloseTo(1, 12);
  });
});

describe('progressOver', () => {
  it('rejects non-positive and non-finite durations', () => {
    expect(() => progressOver(0)).toThrowError(RangeError);
    expect(() => progressOver(-100)).toThrowError(RangeError);
    expect(() => progressOver(Number.NaN)).toThrowError(RangeError);
    expect(() => progressOver(Number.POSITIVE_INFINITY)).toThrowError(RangeError);
  });
});

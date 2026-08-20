import { describe, expect, it } from 'vitest';
import { failure, idle, loading, success } from '../src/loading-state';

describe('LoadingState constructors', () => {
  it('creates idle state', () => {
    expect(idle()).toEqual({ status: 'idle' });
  });

  it('creates loading state', () => {
    expect(loading()).toEqual({ status: 'loading' });
  });

  it('creates success state carrying the value', () => {
    expect(success({ id: 1 })).toEqual({
      status: 'success',
      value: { id: 1 },
    });
  });

  it('creates error state carrying the error', () => {
    const error = new Error('request failed');
    expect(failure(error)).toEqual({ status: 'error', error });
  });
});

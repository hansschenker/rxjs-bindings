export type LoadingState<T, E = unknown> =
  | { readonly status: 'idle' }
  | { readonly status: 'loading' }
  | { readonly status: 'success'; readonly value: T }
  | { readonly status: 'error'; readonly error: E };

export const idle = (): LoadingState<never, never> => ({
  status: 'idle',
});

export const loading = (): LoadingState<never, never> => ({
  status: 'loading',
});

export const success = <T>(value: T): LoadingState<T, never> => ({
  status: 'success',
  value,
});

export const failure = <E>(error: E): LoadingState<never, E> => ({
  status: 'error',
  error,
});

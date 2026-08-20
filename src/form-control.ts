export type ValidationErrors = Readonly<Record<string, unknown>>;

export type Validator<T> = (value: T) => ValidationErrors | null;

export type ControlState<T> = {
  readonly value: T;
  readonly dirty: boolean;
  readonly touched: boolean;
  readonly errors: ValidationErrors | null;
};

export type ControlAction<T> =
  | { readonly type: 'userValueChanged'; readonly value: T }
  | { readonly type: 'setValue'; readonly value: T }
  | { readonly type: 'blurred' }
  | { readonly type: 'reset' };

const hasErrors = (
  errors: ValidationErrors | null,
): errors is ValidationErrors => errors !== null;

/**
 * Runs synchronous validators and merges their error objects.
 * Validators are plain pure functions; RxJS only moves values to them.
 */
export const validate = <T>(
  value: T,
  validators: readonly Validator<T>[],
): ValidationErrors | null => {
  const errors = validators
    .map(validator => validator(value))
    .filter(hasErrors)
    .reduce<ValidationErrors>(
      (allErrors, currentErrors) => ({ ...allErrors, ...currentErrors }),
      {},
    );

  return Object.keys(errors).length === 0 ? null : errors;
};

export const createInitialControlState = <T>(
  initialValue: T,
  validators: readonly Validator<T>[] = [],
): ControlState<T> => ({
  value: initialValue,
  dirty: false,
  touched: false,
  errors: validate(initialValue, validators),
});

/**
 * Creates the pure reducer for one Form Control.
 *
 * userValueChanged marks the control dirty.
 * setValue changes the value without changing dirty/touched state.
 * blurred marks the control touched.
 * reset restores the initial value and lifecycle flags.
 */
export const reduceControlState = <T>(
  initialValue: T,
  validators: readonly Validator<T>[] = [],
) => (
  state: ControlState<T>,
  action: ControlAction<T>,
): ControlState<T> => {
  switch (action.type) {
    case 'userValueChanged':
      return {
        ...state,
        value: action.value,
        dirty: true,
        errors: validate(action.value, validators),
      };

    case 'setValue':
      return {
        ...state,
        value: action.value,
        errors: validate(action.value, validators),
      };

    case 'blurred':
      return {
        ...state,
        touched: true,
      };

    case 'reset':
      return createInitialControlState(initialValue, validators);
  }
};

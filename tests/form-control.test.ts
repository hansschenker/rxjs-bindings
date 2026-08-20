import { describe, expect, it } from 'vitest';
import {
  createInitialControlState,
  reduceControlState,
  validate,
  type Validator,
} from '../src/form-control';

const required: Validator<string> = value =>
  value.trim() === '' ? { required: true } : null;

const minLength = (requiredLength: number): Validator<string> => value =>
  value.length < requiredLength
    ? { minLength: { requiredLength, actualLength: value.length } }
    : null;

const validators: readonly Validator<string>[] = [required, minLength(5)];

describe('validate', () => {
  it('returns null without validators', () => {
    expect(validate('anything', [])).toBeNull();
  });

  it('returns null when every validator passes', () => {
    expect(validate('long enough', validators)).toBeNull();
  });

  it('merges error objects from every failing validator', () => {
    expect(validate('', validators)).toEqual({
      required: true,
      minLength: { requiredLength: 5, actualLength: 0 },
    });
  });

  it('keeps only the failing validators in the result', () => {
    expect(validate('abc', validators)).toEqual({
      minLength: { requiredLength: 5, actualLength: 3 },
    });
  });
});

describe('createInitialControlState', () => {
  it('starts pristine and untouched with validated value', () => {
    expect(createInitialControlState('', validators)).toEqual({
      value: '',
      dirty: false,
      touched: false,
      errors: {
        required: true,
        minLength: { requiredLength: 5, actualLength: 0 },
      },
    });
  });

  it('starts with null errors for a valid initial value', () => {
    expect(createInitialControlState('valid value', validators).errors).toBeNull();
  });
});

describe('reduceControlState', () => {
  const reduce = reduceControlState<string>('', validators);
  const initial = createInitialControlState<string>('', validators);

  it('marks the control dirty and revalidates on userValueChanged', () => {
    const state = reduce(initial, { type: 'userValueChanged', value: 'rxjs!' });

    expect(state).toEqual({
      value: 'rxjs!',
      dirty: true,
      touched: false,
      errors: null,
    });
  });

  it('changes the value without touching lifecycle flags on setValue', () => {
    const state = reduce(initial, { type: 'setValue', value: 'abc' });

    expect(state.value).toBe('abc');
    expect(state.dirty).toBe(false);
    expect(state.touched).toBe(false);
    expect(state.errors).toEqual({
      minLength: { requiredLength: 5, actualLength: 3 },
    });
  });

  it('marks the control touched on blurred', () => {
    const state = reduce(initial, { type: 'blurred' });

    expect(state.touched).toBe(true);
    expect(state.dirty).toBe(false);
    expect(state.value).toBe(initial.value);
  });

  it('restores the initial state on reset', () => {
    const modified = reduce(
      reduce(initial, { type: 'userValueChanged', value: 'edited' }),
      { type: 'blurred' },
    );

    expect(reduce(modified, { type: 'reset' })).toEqual(initial);
  });
});

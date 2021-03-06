// @flow strict

// flowlint unclear-type:off

import {emptyPathArrayError, emptyPathStringError, get, set} from '../src/util';
import SubmitValidationError from '../src/SubmitValidationError';
import DefaultStateProvider from '../src/DefaultStateProvider';

const getInstance = () => {
  const values = {foo: 'value'};
  const warnings = {foo: 'warning'};
  const errors = {foo: 'error'};
  const submitErrors = {foo: 'error'};

  const instance = new DefaultStateProvider({
    ...DefaultStateProvider.defaultProps,
    children() {},
    values,
  });

  (instance: any).setState = (updater, callback) => {
    const nextState = updater(instance.state, instance.props);
    if (nextState !== null) {
      instance.state = nextState;
    }
    if (callback) {
      callback();
    }
  };

  instance.state = {
    ...instance.state,
    valueState: values,
    initialValueState: values,
    pendingValueState: values,
    warningState: warnings,
    errorState: errors,
    submitErrorState: submitErrors,
  };

  return instance;
};

const shallowIntersect = (a: Object, b: Object): string | true => {
  const checked = new Set();
  const keys = Object.keys(a).concat(Object.keys(b));

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];

    if (checked.has(key)) {
      continue;
    }

    checked.add(key);

    if (a[key] === undefined || b[key] === undefined) {
      continue;
    }

    if (!Object.is(a[key], b[key])) {
      return key;
    }
  }

  return true;
};

describe('<DefaultStateProvider/>', () => {
  describe('defaultProps', () => {
    it('should contain expected default functions', async () => {
      const {
        onSubmit,
        onSubmitSuccess,
        onSubmitValidationFail,
        warn,
        validate,
        onSubmitFail,
      } = DefaultStateProvider.defaultProps;

      expect(onSubmit()).toBe(undefined);
      expect(onSubmitSuccess()).toBe(undefined);
      expect(onSubmitValidationFail()).toBe(undefined);

      expect(warn()).toBe(null);
      expect(validate()).toBe(null);

      const error = new Error();

      await expect(onSubmitFail(error)).rejects.toBe(error);
    });
  });

  describe('getInitialState', () => {
    it('should run validation', () => {
      const instance = getInstance();

      const errors = {foo: 'bar'};
      const warnings = {bar: 'foo'};

      instance.props = {
        ...instance.props,
        validate: jest.fn(() => errors),
        warn: jest.fn(() => warnings),
      };

      const state = instance.getInitialState();

      expect(instance.props.validate.mock.calls).toHaveLength(1);
      expect(instance.props.warn.mock.calls).toHaveLength(1);

      expect(state.errorState).toBe(errors);
      expect(state.warningState).toBe(warnings);
    });
  });

  describe('static getDerivedStateFromProps', () => {
    let instance;

    beforeEach(() => {
      instance = getInstance();
    });

    it('should not modify state if no relevant props have changed', () => {
      const nextProps = {...instance.props, foo: 'bar'};

      const state = DefaultStateProvider.getDerivedStateFromProps(
        nextProps,
        instance.state,
      );

      expect(state).toEqual(null);
    });

    it('should return updated state if `values` prop has changed', () => {
      const nextProps = {...instance.props, values: {}};

      const state = DefaultStateProvider.getDerivedStateFromProps(
        nextProps,
        instance.state,
      );

      const {pendingValueState, ...rest} = (state: any);

      // it should set value state at path
      expect(pendingValueState).toBe(nextProps.values);

      // it should leave remaining state values unchanged
      expect(shallowIntersect(rest, instance.state)).toBe(true);
    });

    it('should run `validate` if the prop has changed', () => {
      const nextProps = {
        ...instance.props,
        validate: jest.fn(() => instance.state.errorState),
      };

      const state = DefaultStateProvider.getDerivedStateFromProps(
        nextProps,
        instance.state,
      );

      // Updating `validate` update the `_props` cache.
      const {_props, ...rest} = (state: any);

      expect(nextProps.validate.mock.calls).toHaveLength(1);

      // it should leave remaining state values unchanged
      expect(shallowIntersect(rest, instance.state)).toBe(true);
    });

    it('should run `warn` if the prop has changed', () => {
      const nextProps = {
        ...instance.props,
        warn: jest.fn(() => instance.state.warningState),
      };

      const state = DefaultStateProvider.getDerivedStateFromProps(
        nextProps,
        instance.state,
      );

      // Updating `warn` update the `_props` cache.
      const {_props, ...rest} = (state: any);

      expect(nextProps.warn.mock.calls).toHaveLength(1);

      // it should leave remaining state values unchanged
      expect(shallowIntersect(rest, instance.state)).toBe(true);
    });
  });

  describe('setValue', () => {
    let instance;

    beforeEach(() => {
      instance = getInstance();
    });

    it('should throw if the path is empty', () => {
      expect(() => {
        instance.setValue([], {});
      }).toThrow(emptyPathArrayError());
    });

    it('should not modify state if change is idempotent', () => {
      instance.state = {
        ...instance.state,
        warningState: {},
        errorState: {},
        submitErrorState: {},
      };

      const previousState = instance.state;

      instance.setValue(['foo'], 'value');

      expect(instance.state).toBe(previousState);
    });

    it('should return updated value state', () => {
      instance.state = {
        ...instance.state,
        warningState: null,
        errorState: null,
        submitErrorState: null,
      };

      const previousState = instance.state;

      instance.setValue(['foo'], 'bar');

      const {valueState, ...rest} = instance.state;

      // it should set value state at path
      expect(valueState).not.toBe(previousState.valueState);
      expect(get(valueState, ['foo'])).toBe('bar');

      // it should leave remaining state values unchanged
      expect(shallowIntersect(rest, previousState)).toBe(true);
    });

    it('should run validation', () => {
      const previousState = instance.state;

      const errors = {foo: 'bar'};
      const warnings = {foo: 'foo'};

      // $ExpectError modify sealed props object
      instance.props.validate = jest.fn(() => errors);
      // $ExpectError modify sealed props object
      instance.props.warn = jest.fn(() => warnings);

      instance.setValue(['foo'], 'bar');

      const {
        valueState: _,
        errorState,
        warningState,
        submitErrorState,
        ...rest
      } = instance.state;

      expect(instance.props.validate.mock.calls).toHaveLength(1);
      expect(instance.props.warn.mock.calls).toHaveLength(1);

      expect(errorState).toBe(errors);
      expect(warningState).toBe(warnings);
      expect(submitErrorState).toBe(null);

      // it should leave remaining state values unchanged
      expect(shallowIntersect(rest, previousState)).toBe(true);
    });

    it('should convert empty validation state to null', () => {
      const previousState = instance.state;

      // $ExpectError modify sealed props object
      instance.props.validate = () => ({});
      // $ExpectError modify sealed props object
      instance.props.warn = () => [];

      instance.setValue(['foo'], 'bar');

      const {
        valueState: _,
        errorState,
        warningState,
        submitErrorState,
        ...rest
      } = instance.state;

      expect(errorState).toBe(null);
      expect(warningState).toBe(null);
      expect(submitErrorState).toBe(null);

      // it should leave remaining state values unchanged
      expect(shallowIntersect(rest, previousState)).toBe(true);
    });

    it('should return cleared error and warning state', () => {
      const previousState = instance.state;

      instance.setValue(['foo'], 'bar');

      const {
        valueState: _valueState,
        errorState,
        warningState,
        submitErrorState,
        ...rest
      } = instance.state;

      // it should recalculate has errors state
      expect(errorState).not.toBe(previousState.errorState);
      expect(errorState).toBe(null);

      expect(submitErrorState).not.toBe(previousState.submitErrorState);
      expect(submitErrorState).toBe(null);

      // it should recalculate has warning state
      expect(warningState).not.toBe(previousState.warningState);
      expect(warningState).toBe(null);

      // it should leave remaining state values unchanged
      expect(shallowIntersect(rest, previousState)).toBe(true);
    });
  });

  describe('static setInitialValue', () => {
    let instance;

    beforeEach(() => {
      instance = getInstance();
    });

    it('should throw if the path is empty', () => {
      expect(() => {
        instance.setInitialValue([], {});
      }).toThrow(emptyPathArrayError());
    });

    it('should not modify state if change is idempotent', () => {
      const previousState = instance.state;

      instance.setInitialValue(['foo'], 'value');

      expect(instance.state).toBe(previousState);
    });

    it('should return updated initial value state', () => {
      const previousState = instance.state;

      instance.setInitialValue(['foo'], 'bar');

      const {initialValueState, ...rest} = instance.state;

      // it should set initial value state at path
      expect(initialValueState).not.toBe(previousState.initialValueState);
      expect(get(initialValueState, ['foo'])).toBe('bar');

      // it should leave remaining state values unchanged
      expect(shallowIntersect(rest, previousState)).toBe(true);
    });
  });

  describe('static setPendingValue', () => {
    let instance;

    beforeEach(() => {
      instance = getInstance();
    });

    it('should throw if the path is empty', () => {
      expect(() => {
        instance.setPendingValue([], {});
      }).toThrow(emptyPathArrayError());
    });

    it('should not modify state if change is idempotent', () => {
      const previousState = instance.state;

      instance.setPendingValue(['foo'], 'value');

      expect(instance.state).toBe(previousState);
    });

    it('should return updated pending value state', () => {
      const previousState = instance.state;

      instance.setPendingValue(['foo'], 'bar');

      const {pendingValueState, ...rest} = instance.state;

      // it should set pending value state at path
      expect(pendingValueState).not.toBe(previousState.pendingValueState);
      expect(get(pendingValueState, ['foo'])).toBe('bar');

      // it should leave remaining state values unchanged
      expect(shallowIntersect(rest, previousState)).toBe(true);
    });
  });

  describe('static setVisited', () => {
    let instance;

    beforeEach(() => {
      instance = getInstance();
    });

    it('should throw if the path is empty', () => {
      expect(() => {
        instance.setVisited('', false);
      }).toThrow(emptyPathStringError());
    });

    it('should not modify state if change is idempotent', () => {
      const previousState = instance.state;

      instance.setVisited('foo', false);

      expect(instance.state).toBe(previousState);
    });

    it('should return updated visited state', () => {
      const previousState = instance.state;

      instance.setVisited('foo', true);

      const {visitedMap, ...rest} = instance.state;

      // it should set error state at path
      expect(visitedMap).not.toBe(previousState.visitedMap);
      expect(get(visitedMap, ['foo'])).toBe(true);

      // it should leave remaining state values unchanged
      expect(shallowIntersect(rest, previousState)).toBe(true);
    });
  });

  describe('static setTouched', () => {
    let instance;

    beforeEach(() => {
      instance = getInstance();
    });

    it('should throw if the path is empty', () => {
      expect(() => {
        instance.setTouched('', false);
      }).toThrow(emptyPathStringError());
    });

    it('should not modify state if change is idempotent', () => {
      const previousState = instance.state;

      instance.setTouched('foo', false);

      expect(instance.state).toBe(previousState);
    });

    it('should return updated touched state', () => {
      const previousState = instance.state;

      instance.setTouched('foo', true);

      const {touchedMap, ...rest} = instance.state;

      // it should set error state at path
      expect(touchedMap).not.toBe(previousState.touchedMap);
      expect(get(touchedMap, ['foo'])).toBe(true);

      // it should leave remaining state values unchanged
      expect(shallowIntersect(rest, previousState)).toBe(true);
    });
  });

  describe('static setFocused', () => {
    let instance;

    beforeEach(() => {
      instance = getInstance();
    });

    it('should throw if the path is empty', () => {
      expect(() => {
        instance.setFocused('', false);
      }).toThrow(emptyPathStringError());
    });

    it('should not modify state if change is idempotent', () => {
      {
        instance.state = {...instance.state, focusedPath: 'bar'};

        const previousState = instance.state;

        instance.setFocused('foo', false);

        expect(instance.state).toBe(previousState);
      }
      {
        instance.state = {...instance.state, focusedPath: 'foo'};

        const previousState = instance.state;

        instance.setFocused('foo', true);

        expect(instance.state).toBe(previousState);
      }
    });

    it('should return updated focused state', () => {
      {
        instance.state = set(instance.state, ['focusedPath'], 'bar');

        const previousState = instance.state;

        instance.setFocused('foo', true);

        const {focusedPath, ...rest} = instance.state;

        // it should set error state at path
        expect(focusedPath).not.toBe(previousState.focusedPath);
        expect(focusedPath).toBe('foo');

        // it should leave remaining state values unchanged
        expect(shallowIntersect(rest, previousState)).toBe(true);
      }

      {
        instance.state = set(instance.state, ['focusedPath'], 'foo');

        const previousState = instance.state;

        instance.setFocused('foo', false);

        const {focusedPath, ...rest} = instance.state;

        // it should set error state at path
        expect(focusedPath).not.toBe(previousState.focusedPath);
        expect(focusedPath).toBe(null);

        // it should leave remaining state values unchanged
        expect(shallowIntersect(rest, previousState)).toBe(true);
      }
    });
  });

  describe('submit', () => {
    let instance;
    let promise;

    beforeEach(() => {
      instance = getInstance();
      instance.state = instance.getInitialState();

      promise = new Promise((resolve, reject) => {
        instance.props = {
          ...instance.props,
          onSubmitSuccess: resolve,
          onSubmitFail: reject,
          onSubmitValidationFail: reject,
        };
      });
    });

    it('should prevent default event behavior', async () => {
      const event = {
        preventDefault: jest.fn(),
      };

      instance.submit((event: any));

      await promise;

      expect(event.preventDefault.mock.calls).toHaveLength(1);
    });

    it('should reject if submit is in progress', async () => {
      instance.state = {
        ...instance.state,
        submitting: true,
      };

      instance.submit();

      await expect(promise).rejects.toThrowError(
        'Form submit blocked pending current submit resolution.',
      );
    });

    it('should reject if error state is not null', async () => {
      instance.state = {
        ...instance.state,
        errorState: {foo: 'bar'},
      };

      instance.submit();

      await expect(promise).rejects.toEqual(
        new SubmitValidationError((instance.state.errorState: any)),
      );
    });

    it('should resolve return value of submit handler', async () => {
      const result = {};

      instance.props = {
        ...instance.props,
        onSubmit: jest.fn(() => result),
      };

      instance.submit();

      await expect(promise).resolves.toBe(result);

      expect(instance.props.onSubmit.mock.calls).toHaveLength(1);

      const {
        submitting,
        submitSucceeded,
        submitFailed,
        submitErrorState,
        ...rest
      } = instance.state;

      expect(submitting).toBe(false);
      expect(submitSucceeded).toBe(true);
      expect(submitFailed).toBe(false);
      expect(submitErrorState).toBe(null);

      // it should leave remaining state values unchanged
      expect(shallowIntersect(rest, instance.state)).toBe(true);
    });

    it('should store submit validation errors', async () => {
      const errors = {foo: 'submitError'};

      const error = new SubmitValidationError(errors);

      instance.props = {
        ...instance.props,
        onSubmit: () => Promise.reject(error),
      };

      instance.submit();

      await expect(promise).rejects.toEqual(error);

      const {submitErrorState, ...rest} = instance.state;

      expect(submitErrorState).toBe(errors);

      // it should leave remaining state values unchanged
      expect(shallowIntersect(rest, instance.state)).toBe(true);
    });

    it('should store convert empty submit validation to null', async () => {
      const errors = {};

      const error = new SubmitValidationError(errors);

      instance.props = {
        ...instance.props,
        onSubmit: () => Promise.reject(error),
      };

      instance.submit();

      await expect(promise).rejects.toEqual(error);

      const {submitErrorState, ...rest} = instance.state;

      expect(submitErrorState).toBe(null);

      // it should leave remaining state values unchanged
      expect(shallowIntersect(rest, instance.state)).toBe(true);
    });

    it('should not call setState if the component is unmounted during submit', async () => {
      instance.props = {
        ...instance.props,
        // 3. Invoke the componentWillUnmount callback from within the onSubmit
        // callback tick. This is equivalent to what happens when the Form
        // instance is unmounted as a result of calling submit.
        onSubmit: () => instance.componentWillUnmount(),
      };

      // 1. Submit
      instance.submit();

      // 2. Begin spying on setState. This will count the number of calls to
      // setState after the onSubmit callback prop is invoked.
      jest.spyOn(instance, 'setState');

      // 4. Wait for the onSubmitSuccess callback prop to be called.
      await promise;

      // 5. Assert that setState has not been called.
      expect(instance.setState.mock.calls).toHaveLength(0);
    });
  });

  describe('render', () => {
    let instance;

    beforeEach(() => {
      instance = getInstance();
    });

    it('should return result of current state applied to children', () => {
      const result = {};

      instance.props = {
        ...instance.props,
        children: jest.fn(() => result),
      };

      expect(instance.render()).toBe(result);

      expect(instance.props.children.mock.calls).toHaveLength(1);
      expect(instance.props.children.mock.calls[0][0]).toBe(instance.state);
    });
  });
});

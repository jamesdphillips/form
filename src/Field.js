// @flow
import * as React from 'react';

import type {FieldProps} from './types';
import {Consumer} from './context';
import FieldWrapper from './FieldWrapper';
import renderWrapper from './renderWrapper';

class Field extends React.PureComponent<FieldProps> {
  render() {
    const {
      path,
      format,
      parse,
      checkbox,
      validateOnBlur,
      validateOnChange,
      children,
    } = this.props;

    return (
      <Consumer>
        {(context) =>
          context !== null &&
          renderWrapper(
            FieldWrapper,
            {
              path,
              format,
              parse,
              checkbox,
              validateOnBlur,
              validateOnChange,
            },
            context,
            {children},
          )
        }
      </Consumer>
    );
  }
}

export default Field;

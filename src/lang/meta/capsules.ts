import { SyntaxError } from '@src/core';
import { vm } from '../runtime';

export function beginMethodsImmediate(): never {
  throw new SyntaxError('methods not implemented', vm.getStackData());
}

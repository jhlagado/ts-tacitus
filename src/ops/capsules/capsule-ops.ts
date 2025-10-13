import { VM } from '@src/core';

export function exitConstructorOp(_vm: VM): void {
  throw new Error('ExitConstructor not implemented');
}

export function exitDispatchOp(_vm: VM): void {
  throw new Error('ExitDispatch not implemented');
}

export function dispatchOp(_vm: VM): void {
  throw new Error('dispatch not implemented');
}

export function endCapsuleOp(_vm: VM): void {
  throw new Error('EndCapsule not implemented');
}

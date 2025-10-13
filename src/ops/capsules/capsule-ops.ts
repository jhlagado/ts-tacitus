import { VM } from '@src/core';
import { Op } from '../opcodes';
import { invokeEndDefinitionHandler } from '../../lang/compiler-hooks';

export function exitConstructorOp(_vm: VM): void {
  throw new Error('ExitConstructor not implemented');
}

export function exitDispatchOp(_vm: VM): void {
  throw new Error('ExitDispatch not implemented');
}

export function dispatchOp(_vm: VM): void {
  throw new Error('dispatch not implemented');
}

export function endCapsuleOp(vm: VM): void {
  // Emit the capsule-specific epilogue for the dispatch body
  vm.compiler.compileOpcode(Op.ExitDispatch);
  // Finalise the surrounding colon definition (replaces EndDefinition closer)
  invokeEndDefinitionHandler();
}

import { VM, Tag, toTaggedValue, fromTaggedValue, CELL_SIZE } from '@src/core';
import { Op } from '../opcodes';
import { invokeEndDefinitionHandler } from '../../lang/compiler-hooks';
import { readCapsuleLayoutFromHandle } from './layout';

export function exitConstructorOp(_vm: VM): void {
  throw new Error('ExitConstructor not implemented');
}

export function exitDispatchOp(_vm: VM): void {
  // Epilogue: restore caller BP and return address without touching capsule payload
  const savedBP = _vm.rpop();
  _vm.BP = Math.trunc(savedBP);
  const returnAddr = _vm.rpop();
  const { tag, value } = fromTaggedValue(returnAddr);
  if (tag === Tag.CODE) {
    _vm.IP = value;
  } else {
    _vm.IP = Math.trunc(returnAddr);
  }
}

export function dispatchOp(_vm: VM): void {
  // Stack: args... method receiver
  _vm.ensureStackSize(2, 'dispatch');
  const receiver = _vm.pop();

  // Read capsule layout from handle, validate segment and CODE slot
  const layout = readCapsuleLayoutFromHandle(_vm, receiver);

  // Save caller return address and BP; rebind BP to capsule payload base
  _vm.rpush(toTaggedValue(_vm.IP, Tag.CODE));
  _vm.rpush(_vm.BP);
  _vm.BP = Math.trunc(layout.baseAddr / CELL_SIZE);

  // Jump to dispatch entry address (CODE slot0)
  const { value: entryAddr } = fromTaggedValue(layout.codeRef);
  _vm.IP = entryAddr;
}

export function endCapsuleOp(vm: VM): void {
  // Emit the capsule-specific epilogue for the dispatch body
  vm.compiler.compileOpcode(Op.ExitDispatch);
  // Finalise the surrounding colon definition (replaces EndDefinition closer)
  invokeEndDefinitionHandler();
}

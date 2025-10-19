import {
  VM,
  Tag,
  toTaggedValue,
  fromTaggedValue,
  CELL_SIZE,
  SEG_RSTACK,
  createDataRef,
} from '@src/core';
import { Op } from '../opcodes';
import { invokeEndDefinitionHandler } from '../../lang/compiler-hooks';
import { readCapsuleLayoutFromHandle } from './layout';

export function exitConstructorOp(vm: VM): void {
  // Number of locals currently reserved in this frame (cells)
  const oldBpCells = vm.BP;
  const localCount = vm.RSP - oldBpCells;

  // Wrap current IP as CODE entry for dispatch body
  const entryAddr = vm.IP;
  vm.rpush(toTaggedValue(entryAddr, Tag.CODE));

  // Append LIST header: payload = locals + 1 (CODE)
  vm.rpush(toTaggedValue(localCount + 1, Tag.LIST));

  // Push DATA_REF handle to the capsule header on data stack
  const headerCellIndex = vm.RSP - 1;
  vm.push(createDataRef(SEG_RSTACK, headerCellIndex));

  // Restore caller BP and return address from beneath the frame root
  const savedBP = vm.memory.readFloat32(SEG_RSTACK, (oldBpCells - 1) * CELL_SIZE);
  const returnAddr = vm.memory.readFloat32(SEG_RSTACK, (oldBpCells - 2) * CELL_SIZE);

  vm.BP = Math.trunc(savedBP);
  vm.IP = Math.trunc(returnAddr);
}

export function exitDispatchOp(_vm: VM): void {
  // Epilogue: restore caller BP and return address without touching capsule payload
  _vm.BP = _vm.rpop();
  _vm.IP = _vm.rpop();
}

export function dispatchOp(_vm: VM): void {
  // Stack: args... method receiver
  _vm.ensureStackSize(2, 'dispatch');
  const receiver = _vm.pop();

  // Read capsule layout from handle, validate segment and CODE slot
  const layout = readCapsuleLayoutFromHandle(_vm, receiver);

  // Save caller return address and BP; rebind BP to capsule payload base
  _vm.rpush(_vm.IP);
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

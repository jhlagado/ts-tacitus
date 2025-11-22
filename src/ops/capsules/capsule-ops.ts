import { type VM, RSTACK_BASE, Tagged, Tag, createRef, getTaggedInfo, memoryReadCell } from '@src/core';
import { emitOpcode } from '../../core/vm';
import { encodeX1516, decodeX1516 } from '../../core/code-ref';
import { Op } from '../opcodes';
import { endDefinition } from '../../lang/definition-system';
import { readCapsuleLayoutFromHandle } from './layout';
import { rdepth, rpush, push, rpop, ensureStackSize, pop } from '../../core/vm';

export function exitConstructorOp(vm: VM): void {
  // Number of locals currently reserved in this frame (cells)
  const oldBpRel = vm.bp - RSTACK_BASE;
  const localCount = rdepth(vm) - oldBpRel;

  // Wrap current ip as CODE entry for dispatch body
  const entryAddr = vm.ip;
  rpush(vm, Tagged(encodeX1516(entryAddr), Tag.CODE));

  // Append LIST header: payload = locals + 1 (CODE)
  rpush(vm, Tagged(localCount + 1, Tag.LIST));

  // Push REF handle to the capsule header on data stack
  // Use absolute REF: absoluteCell = (RSTACK_BASE) + headerCellIndex
  const headerCellIndex = rdepth(vm) - 1;
  const absHeaderCellIndex = RSTACK_BASE + headerCellIndex;
  push(vm, createRef(absHeaderCellIndex));

  // Restore caller BP and return address from beneath the frame root
  const savedBP = memoryReadCell(vm.memory, RSTACK_BASE + oldBpRel - 1);
  const returnAddr = memoryReadCell(vm.memory, RSTACK_BASE + oldBpRel - 2);

  // Saved BP stored as relative cells on return stack; restore as absolute
  vm.bp = Math.trunc(savedBP) + RSTACK_BASE;
  vm.ip = Math.trunc(returnAddr);
}

export function exitDispatchOp(vm: VM): void {
  // Epilogue: restore caller BP and return address without touching capsule payload
  // Saved BP stored as relative cells
  vm.bp = rpop(vm) + RSTACK_BASE;
  vm.ip = rpop(vm);
}

export function dispatchOp(vm: VM): void {
  // Stack: args... method receiver
  ensureStackSize(vm, 2, 'dispatch');
  const receiver = pop(vm);

  // Read capsule layout from handle, validate segment and CODE slot
  const layout = readCapsuleLayoutFromHandle(vm, receiver);

  // Save caller return address and BP; rebind BP to capsule payload base
  rpush(vm, vm.ip);
  // Save BP as relative cells for uniform frame convention
  rpush(vm, vm.bp - RSTACK_BASE);
  vm.bp = RSTACK_BASE + (layout.baseCell - RSTACK_BASE);

  // Jump to dispatch entry address (CODE slot0)
  const { value: encodedAddr } = getTaggedInfo(layout.codeRef);
  // Decode X1516 encoded address to get actual bytecode address
  const entryAddr = decodeX1516(encodedAddr);
  vm.ip = entryAddr;
}

export function endCapsuleOp(vm: VM): void {
  // Emit the capsule-specific epilogue for the dispatch body
  emitOpcode(vm, Op.ExitDispatch);
  // Finalise the surrounding colon definition (replaces EndDefinition closer)
  if (vm.compile.defEntryCell === -1) {
    throw new Error('End-definition handler not installed');
  }
  endDefinition(vm);
}

import {
  VM,
  Tag,
  toTaggedValue,
  fromTaggedValue,
  CELL_SIZE,
  SEG_DATA,
  RSTACK_BASE,
  RSTACK_BASE_CELLS,
  createDataRef,
} from '@src/core';
import { Op } from '../opcodes';
import { invokeEndDefinitionHandler } from '../../lang/compiler-hooks';
import { readCapsuleLayoutFromHandle } from './layout';

export function exitConstructorOp(vm: VM): void {
  // Number of locals currently reserved in this frame (cells)
  const oldBpRel = vm.bp - RSTACK_BASE_CELLS;
  const localCount = vm.rdepth() - oldBpRel;

  // Wrap current IP as CODE entry for dispatch body
  const entryAddr = vm.IP;
  vm.rpush(toTaggedValue(entryAddr, Tag.CODE));

  // Append LIST header: payload = locals + 1 (CODE)
  vm.rpush(toTaggedValue(localCount + 1, Tag.LIST));

  // Push DATA_REF handle to the capsule header on data stack
  // Use absolute DATA_REF: absoluteCell = (RSTACK_BASE / CELL_SIZE) + headerCellIndex
  const headerCellIndex = vm.rdepth() - 1;
  const absHeaderCellIndex = RSTACK_BASE_CELLS + headerCellIndex;
  vm.push(createDataRef(absHeaderCellIndex));

  // Restore caller BP and return address from beneath the frame root
  const savedBP = vm.memory.readFloat32(SEG_DATA, RSTACK_BASE + (oldBpRel - 1) * CELL_SIZE);
  const returnAddr = vm.memory.readFloat32(SEG_DATA, RSTACK_BASE + (oldBpRel - 2) * CELL_SIZE);

  // Saved BP stored as relative cells on return stack; restore as absolute
  vm.bp = Math.trunc(savedBP) + RSTACK_BASE_CELLS;
  vm.IP = Math.trunc(returnAddr);
}

export function exitDispatchOp(_vm: VM): void {
  // Epilogue: restore caller BP and return address without touching capsule payload
  // Saved BP stored as relative cells
  _vm.bp = _vm.rpop() + RSTACK_BASE_CELLS;
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
  // Save BP as relative cells for uniform frame convention
  _vm.rpush(_vm.bp - RSTACK_BASE_CELLS);
  // Capsule lives on RSTACK; convert absolute base byte address to frame-relative BP (in cells)
  _vm.bp = RSTACK_BASE_CELLS + Math.trunc((layout.absBaseAddrBytes - RSTACK_BASE) / CELL_SIZE);

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

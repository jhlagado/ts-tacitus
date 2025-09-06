/**
 * @file src/ops/lists/build-ops.ts
 * List construction and conversion operations (builders).
 */

import {
  VM,
  fromTaggedValue,
  toTaggedValue,
  Tag,
  NIL,
  SEG_STACK,
  CELL_SIZE,
  Verb,
} from '@src/core';
import { getListLength, reverseSpan, isList } from '@src/core';
import { getListHeaderAndBase, computeHeaderAddr } from './core-helpers';
import { evalOp } from '../core';
import { ReturnStackUnderflowError } from '@src/core';

/**
 * Opens LIST construction.
 */
export function openListOp(vm: VM): void {
  vm.listDepth++;
  vm.push(toTaggedValue(0, Tag.LIST));
  vm.rpush(vm.SP - CELL_SIZE);
}

/**
 * Closes LIST construction.
 */
export function closeListOp(vm: VM): void {
  if (vm.RP < CELL_SIZE) {
    throw new ReturnStackUnderflowError('closeListOp', vm.getStackData());
  }

  const headerPos = vm.rpop();
  const payloadSlots = (vm.SP - headerPos - CELL_SIZE) / CELL_SIZE;

  vm.memory.writeFloat32(SEG_STACK, headerPos, toTaggedValue(payloadSlots, Tag.LIST));

  const isOutermost = vm.listDepth === 1;
  if (isOutermost) {
    const totalSpan = (vm.SP - headerPos) / CELL_SIZE;
    if (totalSpan > 1) {
      reverseSpan(vm, totalSpan);
    }
  }

  vm.listDepth--;
}

/**
 * Generic block-to-list converter.
 * Stack effect: ( {block} -- list )
 */
export function makeListOp(vm: VM): void {
  vm.ensureStackSize(1, 'makeList');

  const blockAddr = vm.pop();

  const placeholderHeader = toTaggedValue(0, Tag.LIST);
  vm.push(placeholderHeader);
  const headerPos = vm.SP - CELL_SIZE;
  vm.rpush(headerPos);

  vm.push(blockAddr);
  evalOp(vm);

  const taggedHeaderPos = vm.rpop();
  const { value: retrievedHeaderPos } = fromTaggedValue(taggedHeaderPos);
  const payloadSlots = (vm.SP - retrievedHeaderPos - CELL_SIZE) / CELL_SIZE;

  if (payloadSlots < 0) {
    throw new Error('makeList: negative payload slot count detected');
  }

  const finalizedHeader = toTaggedValue(payloadSlots, Tag.LIST);
  vm.memory.writeFloat32(SEG_STACK, retrievedHeaderPos, finalizedHeader);

  const totalSpan = (vm.SP - retrievedHeaderPos) / CELL_SIZE;
  if (totalSpan > 1) {
    reverseSpan(vm, totalSpan);
  }
}

/**
 * Creates list from n stack items.
 * Stack effect: ( item-n ... item-0 n -- list )
 */
export function packOp(vm: VM): void {
  vm.ensureStackSize(1, 'pack');
  const { value: count } = fromTaggedValue(vm.pop());

  if (count < 0 || count > vm.getStackData().length) {
    vm.push(NIL);
    return;
  }

  if (count === 0) {
    vm.push(toTaggedValue(0, Tag.LIST));
    return;
  }

  const values: number[] = [];
  for (let i = 0; i < count; i++) {
    if (vm.getStackData().length === 0) {
      vm.push(NIL);
      return;
    }
    values.push(vm.pop());
  }

  for (let i = values.length - 1; i >= 0; i--) {
    vm.push(values[i]);
  }

  vm.push(toTaggedValue(count, Tag.LIST));
}

/**
 * Pushes list elements onto stack individually.
 * Stack effect: ( list -- item-n ... item-0 )
 * Inverse of pack (without count)
 */
export function unpackOp(vm: VM): void {
  vm.ensureStackSize(1, 'unpack');
  const target = vm.peek();

  const info = getListHeaderAndBase(vm, target);
  if (!info || !isList(info.header)) {
    vm.pop();
    vm.push(NIL);
    return;
  }

  const slotCount = getListLength(info.header);
  // Drop the original target (list header or ref)
  vm.pop();

  if (slotCount === 0) {
    return;
  }

  if (info.segment === SEG_STACK) {
    // Direct list on stack: payload already remains on stack after popping header
    return;
  }

  // Reference case: materialize payload slots deep→TOS order
  const headerAddr = computeHeaderAddr(info.baseAddr, slotCount);
  for (let i = slotCount - 1; i >= 0; i--) {
    const slotValue = vm.memory.readFloat32(info.segment, headerAddr - (i + 1) * CELL_SIZE);
    vm.push(slotValue);
  }
}

/**
 * Converts a single value into a single-element list.
 * Stack effect: ( value — LIST:1 )
 */
export const enlistOp: Verb = (vm: VM) => {
  vm.ensureStackSize(1, 'enlist');
  const a = vm.pop();
  vm.push(a);
  vm.push(toTaggedValue(1, Tag.LIST));
};

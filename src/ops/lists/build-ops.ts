/**
 * @file src/ops/lists/build-ops.ts
 * List construction and conversion operations (builders).
 */

import type { VM, Verb } from '@src/core';
import { fromTaggedValue, toTaggedValue, Tag, NIL, SEG_DATA, CELL_SIZE } from '@src/core';
import { getListLength, reverseSpan, isList } from '@src/core';
import { getListBounds, computeHeaderAddr } from './core-helpers';
import { evalOp } from '../core';
import {
  ensureRStackSize,
  push,
  rpush,
  rpop,
  pop,
  peek,
  ensureStackSize,
  getStackData,
} from '../../core/vm';

/**
 * Opens LIST construction.
 */
export function openListOp(vm: VM): void {
  vm.listDepth++;
  push(vm, toTaggedValue(0, Tag.LIST));
  // Absolute header byte address one past current TOS
  const headerAbsAddr = (vm.sp - 1) * CELL_SIZE;
  rpush(vm, headerAbsAddr);
}

/**
 * Closes LIST construction.
 */
export function closeListOp(vm: VM): void {
  ensureRStackSize(vm, 1, 'closeListOp');

  const headerAbsAddr = rpop(vm);
  const headerCellAbs = headerAbsAddr / CELL_SIZE;
  const payloadSlots = vm.sp - headerCellAbs - 1;

  // Write header at absolute address
  vm.memory.writeCell(headerCellAbs, toTaggedValue(payloadSlots, Tag.LIST));

  const isOutermost = vm.listDepth === 1;
  if (isOutermost) {
    const totalSpan = vm.sp - headerCellAbs;
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
  ensureStackSize(vm, 1, 'makeList');

  const blockAddr = pop(vm);

  const placeholderHeader = toTaggedValue(0, Tag.LIST);
  push(vm, placeholderHeader);
  const headerAbsAddr = (vm.sp - 1) * CELL_SIZE;
  rpush(vm, headerAbsAddr);

  push(vm, blockAddr);
  evalOp(vm);

  const retrievedHeaderAbsAddr = rpop(vm);
  const headerCellAbs = retrievedHeaderAbsAddr / CELL_SIZE;
  const payloadSlots = vm.sp - headerCellAbs - 1;

  if (payloadSlots < 0) {
    throw new Error('makeList: negative payload slot count detected');
  }

  const finalizedHeader = toTaggedValue(payloadSlots, Tag.LIST);
  vm.memory.writeCell(headerCellAbs, finalizedHeader);

  const totalSpan = vm.sp - headerCellAbs;
  if (totalSpan > 1) {
    reverseSpan(vm, totalSpan);
  }
}

/**
 * Creates list from n stack items.
 * Stack effect: ( item-n ... item-0 n -- list )
 */
export function packOp(vm: VM): void {
  ensureStackSize(vm, 1, 'pack');
  const { value: count } = fromTaggedValue(pop(vm));

  if (count < 0 || count > getStackData(vm).length) {
    push(vm, NIL);
    return;
  }

  if (count === 0) {
    push(vm, toTaggedValue(0, Tag.LIST));
    return;
  }

  const values: number[] = [];
  for (let i = 0; i < count; i++) {
    if (getStackData(vm).length === 0) {
      push(vm, NIL);
      return;
    }
    values.push(pop(vm));
  }

  for (let i = values.length - 1; i >= 0; i--) {
    push(vm, values[i]);
  }

  push(vm, toTaggedValue(count, Tag.LIST));
}

/**
 * Pushes list elements onto stack individually.
 * Stack effect: ( list -- item-n ... item-0 )
 * Inverse of pack (without count)
 */
export function unpackOp(vm: VM): void {
  ensureStackSize(vm, 1, 'unpack');
  const target = peek(vm);
  const targetIsDirectList = isList(target);

  const info = getListBounds(vm, target);
  if (!info || !isList(info.header)) {
    pop(vm);
    push(vm, NIL);
    return;
  }

  const slotCount = getListLength(info.header);
  // Drop the original target (list header or ref)
  pop(vm);

  if (slotCount === 0) {
    return;
  }

  if (targetIsDirectList) {
    // Direct list on stack: payload already remains on stack after popping header
    return;
  }

  // Reference case: materialize payload slots deep→TOS order using absolute addressing
  const headerAbsAddr = computeHeaderAddr(info.baseAddrBytes, slotCount);
  const headerCell = headerAbsAddr / CELL_SIZE;
  for (let i = slotCount - 1; i >= 0; i--) {
    const slotValue = vm.memory.readCell(headerCell - (i + 1));
    push(vm, slotValue);
  }
}

/**
 * Converts a single value into a single-element list.
 * Stack effect: ( value — LIST:1 )
 */
export const enlistOp: Verb = (vm: VM) => {
  ensureStackSize(vm, 1, 'enlist');
  const a = pop(vm);
  push(vm, a);
  push(vm, toTaggedValue(1, Tag.LIST));
};

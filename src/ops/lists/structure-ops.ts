/**
 * @file src/ops/lists/structure-ops.ts
 * Structural list operations: head, tail, reverse, concat.
 */

import { VM, toTaggedValue, Tag, NIL, SEG_STACK, CELL_SIZE } from '@src/core';
import { getListLength, isList } from '@src/core';
import { getListHeaderAndBase, computeHeaderAddr } from './core-helpers';
import { isRef } from '@src/core';
import { findElement } from '../stack';

export function tailOp(vm: VM): void {
  vm.ensureStackSize(1, 'tail');
  const target = vm.peek();

  const info = getListHeaderAndBase(vm, target);
  if (!info || !isList(info.header)) {
    vm.pop();
    vm.push(NIL);
    return;
  }

  const slotCount = getListLength(info.header);
  if (slotCount === 0) {
    vm.pop();
    vm.push(toTaggedValue(0, Tag.LIST));
    return;
  }

  const headerAddr = computeHeaderAddr(info.baseAddr, slotCount);
  const firstElemAddr = headerAddr - CELL_SIZE;
  const firstElem = vm.memory.readFloat32(info.segment, firstElemAddr);
  const firstElemSpan = isList(firstElem) ? getListLength(firstElem) + 1 : 1;
  const newSlotCount = slotCount - firstElemSpan;

  vm.pop();

  if (newSlotCount <= 0) {
    vm.push(toTaggedValue(0, Tag.LIST));
    return;
  }

  if (info.segment === SEG_STACK) {
    vm.SP -= firstElemSpan * CELL_SIZE;
    vm.push(toTaggedValue(newSlotCount, Tag.LIST));
  } else {
    for (let i = 0; i < newSlotCount; i++) {
      const elemAddr = firstElemAddr - firstElemSpan * CELL_SIZE - i * CELL_SIZE;
      const elem = vm.memory.readFloat32(info.segment, elemAddr);
      vm.push(elem);
    }
    vm.push(toTaggedValue(newSlotCount, Tag.LIST));
  }
}

export const dropHeadOp = tailOp;

export function headOp(vm: VM): void {
  vm.ensureStackSize(1, 'head');
  const target = vm.peek();

  const info = getListHeaderAndBase(vm, target);
  if (!info || !isList(info.header)) {
    vm.pop();
    vm.push(NIL);
    return;
  }

  const slotCount = getListLength(info.header);
  if (slotCount === 0) {
    vm.pop();
    vm.push(NIL);
    return;
  }

  vm.pop();

  const headerAddr = info.baseAddr + slotCount * CELL_SIZE;
  const firstElementAddr = headerAddr - CELL_SIZE;
  const firstElement = vm.memory.readFloat32(info.segment, firstElementAddr);

  if (isList(firstElement)) {
    const elementSlotCount = getListLength(firstElement);

    if (info.segment === SEG_STACK) {
      vm.SP -= (elementSlotCount + 1) * CELL_SIZE;
      for (let i = elementSlotCount; i >= 0; i--) {
        const slotValue = vm.memory.readFloat32(info.segment, firstElementAddr - i * CELL_SIZE);
        vm.push(slotValue);
      }
    } else {
      for (let i = 0; i < elementSlotCount; i++) {
        const slotValue = vm.memory.readFloat32(
          info.segment,
          firstElementAddr - (elementSlotCount - 1 - i) * CELL_SIZE,
        );
        vm.push(slotValue);
      }
      vm.push(firstElement);
    }
  } else {
    if (info.segment === SEG_STACK) {
      vm.SP -= CELL_SIZE;
    }
    vm.push(firstElement);
  }
}

export function reverseOp(vm: VM): void {
  vm.ensureStackSize(1, 'reverse');
  const target = vm.peek();

  const info = getListHeaderAndBase(vm, target);
  if (!info || !isList(info.header)) {
    vm.pop();
    vm.push(NIL);
    return;
  }

  const slotCount = getListLength(info.header);
  vm.pop();

  if (slotCount === 0) {
    vm.push(toTaggedValue(0, Tag.LIST));
    return;
  }

  const headerAddr = computeHeaderAddr(info.baseAddr, slotCount);
  let currentAddr = headerAddr - CELL_SIZE;
  let remainingSlots = slotCount;
  const elements: Array<{ start: number; span: number }> = [];
  while (remainingSlots > 0) {
    const v = vm.memory.readFloat32(info.segment, currentAddr);
    const span = isList(v) ? getListLength(v) + 1 : 1;
    elements.push({ start: currentAddr, span });
    currentAddr -= span * CELL_SIZE;
    remainingSlots -= span;
  }

  if (info.segment === SEG_STACK) {
    vm.SP -= slotCount * CELL_SIZE;
  }

  for (let e = elements.length - 1; e >= 0; e--) {
    const { start, span } = elements[e];
    if (span === 1) {
      const val = vm.memory.readFloat32(info.segment, start);
      vm.push(val);
    } else {
      const payloadSlots = span - 1;
      for (let i = payloadSlots - 1; i >= 0; i--) {
        const slotVal = vm.memory.readFloat32(info.segment, start - (i + 1) * CELL_SIZE);
        vm.push(slotVal);
      }
      const headerVal = vm.memory.readFloat32(info.segment, start);
      vm.push(headerVal);
    }
  }

  vm.push(toTaggedValue(slotCount, Tag.LIST));
}

export function concatOp(vm: VM): void {
  vm.ensureStackSize(2, 'concat');

  const [, rhsSize] = findElement(vm, 0);
  const [, lhsSize] = findElement(vm, rhsSize);

  const readCellAtOffset = (offsetSlots: number): number => {
    const addr = vm.SP - (offsetSlots + 1) * CELL_SIZE;
    return vm.memory.readFloat32(SEG_STACK, addr);
    };

  const rhsTop = readCellAtOffset(0);
  const lhsTop = readCellAtOffset(rhsSize);

  const rhsInfo = isList(rhsTop)
    ? { kind: 'stack-list' as const, header: rhsTop, headerAddr: vm.SP - CELL_SIZE }
    : isRef(rhsTop)
    ? getListHeaderAndBase(vm, rhsTop)
    : null;
  const lhsHeaderAddr = vm.SP - (rhsSize + 1) * CELL_SIZE;
  const lhsInfo = isList(lhsTop)
    ? { kind: 'stack-list' as const, header: lhsTop, headerAddr: lhsHeaderAddr }
    : isRef(lhsTop)
    ? getListHeaderAndBase(vm, lhsTop)
    : null;

  const lhsIsList = !!lhsInfo;
  const rhsIsList = !!rhsInfo;

  const materializeSlots = (
    op:
      | { kind: 'stack-list'; header: number; headerAddr: number }
      | { header: number; baseAddr: number; segment: number }
      | null,
    size: number,
    topCell: number,
    topOffset: number,
  ): number[] => {
    if (op && 'kind' in op && op.kind === 'stack-list') {
      const s = getListLength(op.header);
      const slots: number[] = [];
      for (let i = 0; i < s; i++) {
        const addr = op.headerAddr - (i + 1) * CELL_SIZE;
        slots.push(vm.memory.readFloat32(SEG_STACK, addr));
      }
      return slots;
    }
    if (op && 'baseAddr' in op) {
      const s = getListLength(op.header);
      const headerAddr = op.baseAddr + s * CELL_SIZE;
      const slots: number[] = [];
      for (let i = 0; i < s; i++) {
        const addr = headerAddr - (i + 1) * CELL_SIZE;
        slots.push(vm.memory.readFloat32(op.segment, addr));
      }
      return slots;
    }
    return [readCellAtOffset(topOffset)];
  };

  const lhsSlots = materializeSlots(lhsInfo as any, lhsSize, lhsTop, rhsSize);
  const rhsSlots = materializeSlots(rhsInfo as any, rhsSize, rhsTop, 0);

  const lhsDrop = lhsIsList && 'kind' in (lhsInfo as any) ? getListLength((lhsInfo as any).header) + 1 : lhsSize;
  const rhsDrop = rhsIsList && 'kind' in (rhsInfo as any) ? getListLength((rhsInfo as any).header) + 1 : rhsSize;

  vm.SP -= (lhsDrop + rhsDrop) * CELL_SIZE;

  for (let i = rhsSlots.length - 1; i >= 0; i--) vm.push(rhsSlots[i]);
  for (let i = lhsSlots.length - 1; i >= 0; i--) vm.push(lhsSlots[i]);
  vm.push(toTaggedValue(lhsSlots.length + rhsSlots.length, Tag.LIST));
}

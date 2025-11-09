/**
 * @file src/ops/lists/structure-ops.ts
 * Structural list operations: head, tail, reverse, concat.
 */

import type { VM } from '@src/core';
import { toTaggedValue, Tag, NIL, SEG_DATA, CELL_SIZE } from '@src/core';
import { getListLength, isList } from '@src/core';
import { getListBounds } from './core-helpers';
import { isRef } from '@src/core';
import { findElement } from '../stack';
import { push, pop, peek, ensureStackSize } from '../../core/vm';

const stackAddrFromTopAbs = (vm: VM, offsetSlots: number): number =>
  (vm.sp - (offsetSlots + 1)) * CELL_SIZE;

export function tailOp(vm: VM): void {
  ensureStackSize(vm, 1, 'tail');
  const target = peek(vm);
  const targetIsDirectList = isList(target);

  const info = getListBounds(vm, target);
  if (!info || !isList(info.header)) {
    pop(vm);
    push(vm, NIL);
    return;
  }

  const slotCount = getListLength(info.header);
  if (slotCount === 0) {
    pop(vm);
    push(vm, toTaggedValue(0, Tag.LIST));
    return;
  }

  const headerAbsAddr = info.baseAddrBytes + slotCount * CELL_SIZE;
  const firstElemCell = (headerAbsAddr - CELL_SIZE) / CELL_SIZE;
  const firstElem = vm.memory.readCell(firstElemCell);
  const firstElemSpan = isList(firstElem) ? getListLength(firstElem) + 1 : 1;
  const newSlotCount = slotCount - firstElemSpan;

  pop(vm);

  if (newSlotCount <= 0) {
    push(vm, toTaggedValue(0, Tag.LIST));
    return;
  }

  if (targetIsDirectList) {
    vm.sp -= firstElemSpan;
    push(vm, toTaggedValue(newSlotCount, Tag.LIST));
  } else {
    for (let i = 0; i < newSlotCount; i++) {
      const elemCell = firstElemCell - firstElemSpan - i;
      const elem = vm.memory.readCell(elemCell);
      push(vm, elem);
    }
    push(vm, toTaggedValue(newSlotCount, Tag.LIST));
  }
}

export const dropHeadOp = tailOp;

export function headOp(vm: VM): void {
  ensureStackSize(vm, 1, 'head');
  const target = peek(vm);
  const targetIsDirectList = isList(target);

  const info = getListBounds(vm, target);
  if (!info || !isList(info.header)) {
    pop(vm);
    push(vm, NIL);
    return;
  }

  const slotCount = getListLength(info.header);
  if (slotCount === 0) {
    pop(vm);
    push(vm, NIL);
    return;
  }

  pop(vm);

  const headerAbsAddr = info.baseAddrBytes + slotCount * CELL_SIZE;
  const firstElementCell = (headerAbsAddr - CELL_SIZE) / CELL_SIZE;
  const firstElement = vm.memory.readCell(firstElementCell);

  if (isList(firstElement)) {
    const elementSlotCount = getListLength(firstElement);

    if (targetIsDirectList) {
      vm.sp -= elementSlotCount + 1;
      for (let i = elementSlotCount; i >= 0; i--) {
        const slotValue = vm.memory.readCell(firstElementCell - i);
        push(vm, slotValue);
      }
    } else {
      for (let i = 0; i < elementSlotCount; i++) {
        const slotValue = vm.memory.readCell(firstElementCell - (elementSlotCount - 1 - i));
        push(vm, slotValue);
      }
      push(vm, firstElement);
    }
  } else {
    if (targetIsDirectList) {
      vm.sp -= 1;
    }
    push(vm, firstElement);
  }
}

export function reverseOp(vm: VM): void {
  ensureStackSize(vm, 1, 'reverse');
  const target = peek(vm);
  const targetIsDirectList = isList(target);

  const info = getListBounds(vm, target);
  if (!info || !isList(info.header)) {
    pop(vm);
    push(vm, NIL);
    return;
  }

  const slotCount = getListLength(info.header);
  pop(vm);

  if (slotCount === 0) {
    push(vm, toTaggedValue(0, Tag.LIST));
    return;
  }

  const headerAbsAddr = info.baseAddrBytes + slotCount * CELL_SIZE;
  let currentCell = (headerAbsAddr - CELL_SIZE) / CELL_SIZE;
  let remainingSlots = slotCount;
  const elements: { start: number; span: number }[] = [];
  while (remainingSlots > 0) {
    const v = vm.memory.readCell(currentCell);
    const span = isList(v) ? getListLength(v) + 1 : 1;
    elements.push({ start: currentCell, span });
    currentCell -= span;
    remainingSlots -= span;
  }

  if (targetIsDirectList) {
    vm.sp -= slotCount;
  }

  for (let e = elements.length - 1; e >= 0; e--) {
    const { start, span } = elements[e];
    if (span === 1) {
      const val = vm.memory.readCell(start);
      push(vm, val);
    } else {
      const payloadSlots = span - 1;
      for (let i = payloadSlots - 1; i >= 0; i--) {
        const slotVal = vm.memory.readCell(start - (i + 1));
        push(vm, slotVal);
      }
      const headerVal = vm.memory.readCell(start);
      push(vm, headerVal);
    }
  }

  push(vm, toTaggedValue(slotCount, Tag.LIST));
}

export function concatOp(vm: VM): void {
  ensureStackSize(vm, 2, 'concat');

  const [, rhsSize] = findElement(vm, 0);
  const [, lhsSize] = findElement(vm, rhsSize);

  const readCellAtOffset = (offsetSlots: number): number => {
    const absAddr = stackAddrFromTopAbs(vm, offsetSlots);
    return vm.memory.readCell(absAddr / CELL_SIZE);
  };

  const rhsTop = readCellAtOffset(0);
  const lhsTop = readCellAtOffset(rhsSize);

  const rhsInfo = isList(rhsTop)
    ? { kind: 'stack-list' as const, header: rhsTop, headerAddr: (vm.sp - 1) * CELL_SIZE }
    : isRef(rhsTop)
      ? getListBounds(vm, rhsTop)
      : null;
  const lhsHeaderAddr = (vm.sp - (rhsSize + 1)) * CELL_SIZE;
  const lhsInfo = isList(lhsTop)
    ? { kind: 'stack-list' as const, header: lhsTop, headerAddr: lhsHeaderAddr }
    : isRef(lhsTop)
      ? getListBounds(vm, lhsTop)
      : null;

  const lhsIsList = !!lhsInfo;
  const rhsIsList = !!rhsInfo;

  const materializeSlots = (
    op:
      | { kind: 'stack-list'; header: number; headerAddr: number }
      | { header: number; baseAddrBytes: number }
      | null,
    _size: number,
    _topCell: number,
    topOffset: number,
  ): number[] => {
    if (op && 'kind' in op && op.kind === 'stack-list') {
      const s = getListLength(op.header);
      const slots: number[] = [];
      for (let i = 0; i < s; i++) {
        const cellIndex = (op.headerAddr - (i + 1) * CELL_SIZE) / CELL_SIZE;
        slots.push(vm.memory.readCell(cellIndex));
      }
      return slots;
    }
    if (op && 'baseAddrBytes' in op) {
      const s = getListLength(op.header);
      const headerAbsAddr = op.baseAddrBytes + s * CELL_SIZE;
      const slots: number[] = [];
      for (let i = 0; i < s; i++) {
        const cellIndex = (headerAbsAddr - (i + 1) * CELL_SIZE) / CELL_SIZE;
        slots.push(vm.memory.readCell(cellIndex));
      }
      return slots;
    }
    return [readCellAtOffset(topOffset)];
  };

  const lhsSlots = materializeSlots(
    (lhsInfo as
      | { kind: 'stack-list'; header: number; headerAddr: number }
      | { header: number; baseAddrBytes: number }
      | null) ?? null,
    lhsSize,
    lhsTop,
    rhsSize,
  );
  const rhsSlots = materializeSlots(
    (rhsInfo as
      | { kind: 'stack-list'; header: number; headerAddr: number }
      | { header: number; baseAddrBytes: number }
      | null) ?? null,
    rhsSize,
    rhsTop,
    0,
  );

  const lhsDrop =
    lhsIsList && lhsInfo && 'kind' in lhsInfo
      ? getListLength((lhsInfo as { kind: 'stack-list'; header: number }).header) + 1
      : lhsSize;
  const rhsDrop =
    rhsIsList && rhsInfo && 'kind' in rhsInfo
      ? getListLength((rhsInfo as { kind: 'stack-list'; header: number }).header) + 1
      : rhsSize;

  vm.sp -= lhsDrop + rhsDrop;

  for (let i = rhsSlots.length - 1; i >= 0; i--) {
push(vm, rhsSlots[i]);
}
  for (let i = lhsSlots.length - 1; i >= 0; i--) {
push(vm, lhsSlots[i]);
}
  push(vm, toTaggedValue(lhsSlots.length + rhsSlots.length, Tag.LIST));
}

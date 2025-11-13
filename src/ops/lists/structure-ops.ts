/**
 * @file src/ops/lists/structure-ops.ts
 * Structural list operations: head, tail, reverse, concat.
 */

import type { VM } from '@src/core';
import { Tagged, Tag, NIL, SEG_DATA, CELL_SIZE } from '@src/core';
import { getListLength, isList } from '@src/core';
import { getListBounds } from './core-helpers';
import { isRef } from '@src/core';
import { findElement } from '../stack';
import { push, pop, peek, ensureStackSize } from '../../core/vm';

const stackCellFromTop = (vm: VM, offsetSlots: number): number => vm.sp - (offsetSlots + 1);

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
    push(vm, Tagged(0, Tag.LIST));
    return;
  }

  const hdr = info.headerCell;
  const firstElemCell = hdr - 1;
  const firstElem = vm.memory.readCell(firstElemCell);
  const firstElemSpan = isList(firstElem) ? getListLength(firstElem) + 1 : 1;
  const newSlotCount = slotCount - firstElemSpan;

  pop(vm);

  if (newSlotCount <= 0) {
    push(vm, Tagged(0, Tag.LIST));
    return;
  }

  if (targetIsDirectList) {
    vm.sp -= firstElemSpan;
    push(vm, Tagged(newSlotCount, Tag.LIST));
  } else {
    for (let i = 0; i < newSlotCount; i++) {
      const elemCell = firstElemCell - firstElemSpan - i;
      const elem = vm.memory.readCell(elemCell);
      push(vm, elem);
    }
    push(vm, Tagged(newSlotCount, Tag.LIST));
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

  const hdr = info.headerCell;
  const firstElementCell = hdr - 1;
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
    push(vm, Tagged(0, Tag.LIST));
    return;
  }

  const hdr = info.headerCell;
  let currentCell = hdr - 1;
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

  push(vm, Tagged(slotCount, Tag.LIST));
}

export function concatOp(vm: VM): void {
  ensureStackSize(vm, 2, 'concat');

  const [, rhsSize] = findElement(vm, 0);
  const [, lhsSize] = findElement(vm, rhsSize);

  const readCellAtOffset = (offsetSlots: number): number => {
    const cell = stackCellFromTop(vm, offsetSlots);
    return vm.memory.readCell(cell);
  };

  const rhsTop = readCellAtOffset(0);
  const lhsTop = readCellAtOffset(rhsSize);

  const rhsInfo = isList(rhsTop)
    ? { kind: 'stack-list' as const, header: rhsTop, headerCell: vm.sp - 1 }
    : isRef(rhsTop)
      ? getListBounds(vm, rhsTop)
      : null;
  const lhsHeaderCell = vm.sp - (rhsSize + 1);
  const lhsInfo = isList(lhsTop)
    ? { kind: 'stack-list' as const, header: lhsTop, headerCell: lhsHeaderCell }
    : isRef(lhsTop)
      ? getListBounds(vm, lhsTop)
      : null;

  const lhsIsList = !!lhsInfo;
  const rhsIsList = !!rhsInfo;

  const materializeSlots = (
    op:
      | { kind: 'stack-list'; header: number; headerCell: number }
      | { header: number; baseCell: number }
      | null,
    _size: number,
    _topCell: number,
    topOffset: number,
  ): number[] => {
    if (op && 'kind' in op && op.kind === 'stack-list') {
      const s = getListLength(op.header);
      const slots: number[] = [];
      for (let i = 0; i < s; i++) {
        const cellIndex = op.headerCell - 1 - i;
        slots.push(vm.memory.readCell(cellIndex));
      }
      return slots;
    }
    if (op && 'baseCell' in op) {
      const s = getListLength(op.header);
      const hdr = op.baseCell + s;
      const slots: number[] = [];
      for (let i = 0; i < s; i++) {
        const cell = hdr - 1 - i;
        slots.push(vm.memory.readCell(cell));
      }
      return slots;
    }
    return [readCellAtOffset(topOffset)];
  };

  const lhsSlots = materializeSlots(
    (lhsInfo as
      | { kind: 'stack-list'; header: number; headerCell: number }
      | { header: number; baseCell: number }
      | null) ?? null,
    lhsSize,
    lhsTop,
    rhsSize,
  );
  const rhsSlots = materializeSlots(
    (rhsInfo as
      | { kind: 'stack-list'; header: number; headerCell: number }
      | { header: number; baseCell: number }
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
  push(vm, Tagged(lhsSlots.length + rhsSlots.length, Tag.LIST));
}

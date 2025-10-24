/**
 * @file src/ops/lists/structure-ops.ts
 * Structural list operations: head, tail, reverse, concat.
 */

import { VM, toTaggedValue, Tag, NIL, SEG_DATA, CELL_SIZE, STACK_BASE } from '@src/core';
import { getListLength, isList } from '@src/core';
import { getListBoundsAbs } from './core-helpers';
import { isRef } from '@src/core';
import { findElement } from '../stack';

const stackAddrFromTop = (vm: VM, offsetSlots: number): number =>
  (vm.SP - (offsetSlots + 1)) * CELL_SIZE;

export function tailOp(vm: VM): void {
  vm.ensureStackSize(1, 'tail');
  const target = vm.peek();
  const targetIsDirectList = isList(target);

  const info = getListBoundsAbs(vm, target);
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

  const headerAbsAddr = info.absBaseAddrBytes + slotCount * CELL_SIZE;
  const firstElemAbsAddr = headerAbsAddr - CELL_SIZE;
  const firstElem = vm.memory.readFloat32(SEG_DATA, firstElemAbsAddr);
  const firstElemSpan = isList(firstElem) ? getListLength(firstElem) + 1 : 1;
  const newSlotCount = slotCount - firstElemSpan;

  vm.pop();

  if (newSlotCount <= 0) {
    vm.push(toTaggedValue(0, Tag.LIST));
    return;
  }

  if (targetIsDirectList) {
    vm.SP -= firstElemSpan;
    vm.push(toTaggedValue(newSlotCount, Tag.LIST));
  } else {
    for (let i = 0; i < newSlotCount; i++) {
      const elemAbsAddr = firstElemAbsAddr - firstElemSpan * CELL_SIZE - i * CELL_SIZE;
      const elem = vm.memory.readFloat32(SEG_DATA, elemAbsAddr);
      vm.push(elem);
    }
    vm.push(toTaggedValue(newSlotCount, Tag.LIST));
  }
}

export const dropHeadOp = tailOp;

export function headOp(vm: VM): void {
  vm.ensureStackSize(1, 'head');
  const target = vm.peek();
  const targetIsDirectList = isList(target);

  const info = getListBoundsAbs(vm, target);
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

  const headerAbsAddr = info.absBaseAddrBytes + slotCount * CELL_SIZE;
  const firstElementAbsAddr = headerAbsAddr - CELL_SIZE;
  const firstElement = vm.memory.readFloat32(SEG_DATA, firstElementAbsAddr);

  if (isList(firstElement)) {
    const elementSlotCount = getListLength(firstElement);

    if (targetIsDirectList) {
      vm.SP -= elementSlotCount + 1;
      for (let i = elementSlotCount; i >= 0; i--) {
        const slotValue = vm.memory.readFloat32(SEG_DATA, firstElementAbsAddr - i * CELL_SIZE);
        vm.push(slotValue);
      }
    } else {
      for (let i = 0; i < elementSlotCount; i++) {
        const slotValue = vm.memory.readFloat32(
          SEG_DATA,
          firstElementAbsAddr - (elementSlotCount - 1 - i) * CELL_SIZE,
        );
        vm.push(slotValue);
      }
      vm.push(firstElement);
    }
  } else {
    if (targetIsDirectList) {
      vm.SP -= 1;
    }
    vm.push(firstElement);
  }
}

export function reverseOp(vm: VM): void {
  vm.ensureStackSize(1, 'reverse');
  const target = vm.peek();
  const targetIsDirectList = isList(target);

  const info = getListBoundsAbs(vm, target);
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

  const headerAbsAddr = info.absBaseAddrBytes + slotCount * CELL_SIZE;
  let currentAbsAddr = headerAbsAddr - CELL_SIZE;
  let remainingSlots = slotCount;
  const elements: Array<{ start: number; span: number }> = [];
  while (remainingSlots > 0) {
    const v = vm.memory.readFloat32(SEG_DATA, currentAbsAddr);
    const span = isList(v) ? getListLength(v) + 1 : 1;
    elements.push({ start: currentAbsAddr, span });
    currentAbsAddr -= span * CELL_SIZE;
    remainingSlots -= span;
  }

  if (targetIsDirectList) {
    vm.SP -= slotCount;
  }

  for (let e = elements.length - 1; e >= 0; e--) {
    const { start, span } = elements[e];
    if (span === 1) {
      const val = vm.memory.readFloat32(SEG_DATA, start);
      vm.push(val);
    } else {
      const payloadSlots = span - 1;
      for (let i = payloadSlots - 1; i >= 0; i--) {
        const slotVal = vm.memory.readFloat32(SEG_DATA, start - (i + 1) * CELL_SIZE);
        vm.push(slotVal);
      }
      const headerVal = vm.memory.readFloat32(SEG_DATA, start);
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
    const addr = stackAddrFromTop(vm, offsetSlots);
    return vm.memory.readFloat32(SEG_DATA, STACK_BASE + addr);
  };

  const rhsTop = readCellAtOffset(0);
  const lhsTop = readCellAtOffset(rhsSize);

  const rhsInfo = isList(rhsTop)
    ? { kind: 'stack-list' as const, header: rhsTop, headerAddr: (vm.SP - 1) * CELL_SIZE }
    : isRef(rhsTop)
      ? getListBoundsAbs(vm, rhsTop)
      : null;
  const lhsHeaderAddr = (vm.SP - (rhsSize + 1)) * CELL_SIZE;
  const lhsInfo = isList(lhsTop)
    ? { kind: 'stack-list' as const, header: lhsTop, headerAddr: lhsHeaderAddr }
    : isRef(lhsTop)
      ? getListBoundsAbs(vm, lhsTop)
      : null;

  const lhsIsList = !!lhsInfo;
  const rhsIsList = !!rhsInfo;

  const materializeSlots = (
    op:
      | { kind: 'stack-list'; header: number; headerAddr: number }
      | { header: number; absBaseAddrBytes: number }
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
        slots.push(vm.memory.readFloat32(SEG_DATA, STACK_BASE + addr));
      }
      return slots;
    }
    if (op && 'absBaseAddrBytes' in op) {
      const s = getListLength(op.header);
      const headerAbsAddr = op.absBaseAddrBytes + s * CELL_SIZE;
      const slots: number[] = [];
      for (let i = 0; i < s; i++) {
        const absAddr = headerAbsAddr - (i + 1) * CELL_SIZE;
        slots.push(vm.memory.readFloat32(SEG_DATA, absAddr));
      }
      return slots;
    }
    return [readCellAtOffset(topOffset)];
  };

  const lhsSlots = materializeSlots(
    (lhsInfo as
      | { kind: 'stack-list'; header: number; headerAddr: number }
      | { header: number; absBaseAddrBytes: number }
      | null) ?? null,
    lhsSize,
    lhsTop,
    rhsSize,
  );
  const rhsSlots = materializeSlots(
    (rhsInfo as
      | { kind: 'stack-list'; header: number; headerAddr: number }
      | { header: number; absBaseAddrBytes: number }
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

  vm.SP -= lhsDrop + rhsDrop;

  for (let i = rhsSlots.length - 1; i >= 0; i--) vm.push(rhsSlots[i]);
  for (let i = lhsSlots.length - 1; i >= 0; i--) vm.push(lhsSlots[i]);
  vm.push(toTaggedValue(lhsSlots.length + rhsSlots.length, Tag.LIST));
}

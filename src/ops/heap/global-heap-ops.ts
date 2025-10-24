/**
 * @file src/ops/heap/global-heap-ops.ts
 * Implements Tacit global heap primitives (gpush, gpop, gpeek, gmark, gsweep).
 */

import {
  VM,
  getTag,
  Tag,
  isRef,
  SEG_DATA,
  GLOBAL_BASE,
  CELL_SIZE,
  dropList,
  getListBoundsAbs,
  isList,
  getListLength,
  pushListToGlobalHeap,
  pushSimpleToGlobalHeap,
  readRefValueAbs,
  getAbsoluteCellIndexFromRef,
} from '@src/core';
import { fetchOp } from '../lists';

function ensureGlobalRefAbs(vm: VM, ref: number): { absCellIndex: number } {
  const absCellIndex = getAbsoluteCellIndexFromRef(ref);
  const globalBaseCell = GLOBAL_BASE / CELL_SIZE;
  if (absCellIndex < globalBaseCell || absCellIndex >= globalBaseCell + (vm.GP || 0)) {
    throw new Error('Expected global heap reference');
  }
  return { absCellIndex };
}

function copyListOntoHeap(vm: VM, boundsReturn: ReturnType<typeof getListBoundsAbs>): number {
  if (!boundsReturn) {
    throw new Error('List bounds unavailable for heap copy');
  }
  const compat = {
    header: boundsReturn.header,
    baseAddr: 0,
    segment: 2,
    absBaseAddrBytes: boundsReturn.absBaseAddrBytes,
  } as const;
  return pushListToGlobalHeap(vm, compat);
}

export function gmarkOp(vm: VM): void {
  vm.push(vm.GP);
}

export function gsweepOp(vm: VM): void {
  vm.ensureStackSize(1, 'gsweep');
  const markValue = vm.pop();
  if (!Number.isFinite(markValue) || !Number.isInteger(markValue)) {
    throw new Error('gsweep expects integer heap mark');
  }
  const mark = markValue;
  if (mark < 0 || mark > vm.GP) {
    throw new Error('gsweep mark out of range');
  }
  vm.GP = mark;
}

export function gpushOp(vm: VM): void {
  vm.ensureStackSize(1, 'gpush');
  const value = vm.peek();
  const listInfo = getListBoundsAbs(vm, value);
  if (listInfo) {
    const ref = copyListOntoHeap(vm, listInfo);
    const valueTag = getTag(value);
    if (valueTag === Tag.LIST) {
      dropList(vm);
    } else {
      vm.pop();
    }
    vm.push(ref);
    return;
  }

  if (isRef(value)) {
    let simple = readRefValueAbs(vm, value);
    if (isRef(simple)) {
      simple = readRefValueAbs(vm, simple);
    }
    const heapRef = pushSimpleToGlobalHeap(vm, simple);
    vm.pop();
    vm.push(heapRef);
    return;
  }

  const heapRef = pushSimpleToGlobalHeap(vm, value);
  vm.pop();
  vm.push(heapRef);
}

export function gpeekOp(vm: VM): void {
  vm.ensureStackSize(1, 'gpeek');
  const ref = vm.peek();
  if (!isRef(ref)) {
    throw new Error('gpeek expects DATA_REF');
  }
  ensureGlobalRefAbs(vm, ref);
  vm.push(ref);
  fetchOp(vm);
}

export function gpopOp(vm: VM): void {
  vm.ensureStackSize(1, 'gpop');
  if (vm.GP === 0) {
    throw new Error('gpop on empty heap');
  }

  const ref = vm.pop();
  if (!isRef(ref)) {
    throw new Error('gpop expects DATA_REF');
  }
  const { absCellIndex } = ensureGlobalRefAbs(vm, ref);
  const globalBaseCell = GLOBAL_BASE / CELL_SIZE;
  const topAbsCellIndex = globalBaseCell + vm.GP - 1;
  if (absCellIndex !== topAbsCellIndex) {
    throw new Error('gpop expects reference to heap top');
  }

  // Read header via unified data segment (absolute byte offset)
  const headerValue = vm.memory.readFloat32(SEG_DATA, absCellIndex * CELL_SIZE);
  if (isList(headerValue)) {
    const span = getListLength(headerValue) + 1;
    vm.GP -= span;
    return;
  }
  vm.GP = vm.GP - 1;
}

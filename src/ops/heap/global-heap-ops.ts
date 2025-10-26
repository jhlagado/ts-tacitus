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
  getListBounds,
  isList,
  getListLength,
  pushListToGlobalHeap,
  pushSimpleToGlobalHeap,
  readRefValue,
  getAbsoluteCellIndexFromRef,
} from '@src/core';
import { fetchOp } from '../lists';

function ensureGlobalRef(vm: VM, ref: number): { absCellIndex: number } {
  const absCellIndex = getAbsoluteCellIndexFromRef(ref);
  const globalBaseCell = GLOBAL_BASE / CELL_SIZE;
  if (absCellIndex < globalBaseCell || absCellIndex >= globalBaseCell + (vm.gp || 0)) {
    throw new Error('Expected global heap reference');
  }
  return { absCellIndex };
}

function copyListOntoHeap(vm: VM, boundsReturn: ReturnType<typeof getListBounds>): number {
  if (!boundsReturn) {
    throw new Error('List bounds unavailable for heap copy');
  }
  return pushListToGlobalHeap(vm, {
    header: boundsReturn.header,
    absBaseAddrBytes: boundsReturn.absBaseAddrBytes,
  });
}

export function gmarkOp(vm: VM): void {
  vm.push(vm.gp);
}

export function gsweepOp(vm: VM): void {
  vm.ensureStackSize(1, 'gsweep');
  const markValue = vm.pop();
  if (!Number.isFinite(markValue) || !Number.isInteger(markValue)) {
    throw new Error('gsweep expects integer heap mark');
  }
  const mark = markValue;
  if (mark < 0 || mark > vm.gp) {
    throw new Error('gsweep mark out of range');
  }
  vm.gp = mark;
}

export function gpushOp(vm: VM): void {
  vm.ensureStackSize(1, 'gpush');
  const value = vm.peek();
  const listInfo = getListBounds(vm, value);
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
    let simple = readRefValue(vm, value);
    if (isRef(simple)) {
      simple = readRefValue(vm, simple);
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
  ensureGlobalRef(vm, ref);
  vm.push(ref);
  fetchOp(vm);
}

export function gpopOp(vm: VM): void {
  vm.ensureStackSize(1, 'gpop');
  if (vm.gp === 0) {
    throw new Error('gpop on empty heap');
  }

  const ref = vm.pop();
  if (!isRef(ref)) {
    throw new Error('gpop expects DATA_REF');
  }
  const { absCellIndex } = ensureGlobalRef(vm, ref);
  const globalBaseCell = GLOBAL_BASE / CELL_SIZE;
  const topAbsCellIndex = globalBaseCell + vm.gp - 1;
  if (absCellIndex !== topAbsCellIndex) {
    throw new Error('gpop expects reference to heap top');
  }

  // Read header via unified data segment (absolute byte offset)
  const headerValue = vm.memory.readFloat32(SEG_DATA, absCellIndex * CELL_SIZE);
  if (isList(headerValue)) {
    const span = getListLength(headerValue) + 1;
    vm.gp -= span;
    return;
  }
  vm.gp = vm.gp - 1;
}

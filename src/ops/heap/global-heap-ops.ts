/**
 * @file src/ops/heap/global-heap-ops.ts
 * Implements Tacit global heap primitives (gpush, gpop, gpeek, gmark, gsweep).
 */

import {
  VM,
  getTag,
  Tag,
  isRef,
  decodeDataRef,
  resolveReference,
  SEG_GLOBAL,
  SEG_DATA,
  SEG_RSTACK,
  SEG_STACK,
  RSTACK_BASE,
  STACK_BASE,
  GLOBAL_BASE,
  CELL_SIZE,
  dropList,
  getListBounds,
  isList,
  getListLength,
  pushListToGlobalHeap,
  pushSimpleToGlobalHeap,
} from '@src/core';
import { loadOp } from '../lists';

function ensureGlobalRef(ref: number): { cellIndex: number } {
  const { segment, cellIndex } = decodeDataRef(ref);
  if (segment !== SEG_GLOBAL) {
    throw new Error('Expected global heap reference');
  }
  return { cellIndex };
}

function copyListOntoHeap(vm: VM, boundsReturn: ReturnType<typeof getListBounds>): number {
  if (!boundsReturn) {
    throw new Error('List bounds unavailable for heap copy');
  }
  return pushListToGlobalHeap(vm, boundsReturn);
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
    const ref = resolveReference(vm, value);
    const base = ref.segment === SEG_GLOBAL ? GLOBAL_BASE : ref.segment === SEG_RSTACK ? RSTACK_BASE : STACK_BASE;
    let simple = vm.memory.readFloat32(SEG_DATA, base + ref.address);
    if (isRef(simple)) {
      const inner = resolveReference(vm, simple);
      const innerBase = inner.segment === SEG_GLOBAL ? GLOBAL_BASE : inner.segment === SEG_RSTACK ? RSTACK_BASE : STACK_BASE;
      simple = vm.memory.readFloat32(SEG_DATA, innerBase + inner.address);
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
  const { segment } = decodeDataRef(ref);
  if (segment !== SEG_GLOBAL) {
    throw new Error('gpeek expects global heap reference');
  }
  vm.push(ref);
  loadOp(vm);
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
  const { cellIndex } = ensureGlobalRef(ref);
  const topIndex = vm.GP - 1;
  if (cellIndex !== topIndex) {
    throw new Error('gpop expects reference to heap top');
  }

  // Read header via unified data segment (absolute byte offset)
  const headerValue = vm.memory.readFloat32(SEG_DATA, GLOBAL_BASE + cellIndex * CELL_SIZE);
  if (isList(headerValue)) {
    const span = getListLength(headerValue) + 1;
    vm.GP -= span;
    return;
  }
  vm.GP = topIndex;
}

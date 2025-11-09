/**
 * @file src/ops/heap/global-heap-ops.ts
 * Implements Tacit global heap primitives (gpush, gpop, gpeek, gmark, gsweep).
 */

import type { VM } from '@src/core';
import {
  SEG_DATA,
  GLOBAL_BASE_CELLS,
  CELL_SIZE,
  dropList,
  isList,
  getListLength,
  pushListToGlobalHeap,
  pushSimpleToGlobalHeap,
  isRef,
  readRefValue,
  getByteAddressFromRef,
  validateListHeader,
  createGlobalRef,
  getAbsoluteCellIndexFromRef,
} from '@src/core';
import { fetchOp } from '../lists';
import { push, pop, peek, ensureStackSize } from '../../core/vm';
// createGlobalRef now imported from core in the line above

// No reference validation helpers needed in the simplified model

// Internal helper: copy a LIST to the global heap given its header value and absolute
// header address in bytes. Computes base once and delegates to pushListToGlobalHeap.
function copyListAtHeader(vm: VM, h: number, hAddr: number): void {
  const n = getListLength(h);
  const base = hAddr - n * CELL_SIZE;
  pushListToGlobalHeap(vm, { header: h, baseAddrBytes: base });
}

export function gmarkOp(vm: VM): void {
  push(vm, vm.gp);
}

export function gsweepOp(vm: VM): void {
  ensureStackSize(vm, 1, 'gsweep');
  const markValue = pop(vm);
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
  ensureStackSize(vm, 1, 'gpush');
  // If TOS is a ref: deep-copy list directly; for simples, copy resolved value now
  const v = peek(vm);
  if (isRef(v)) {
    const dv = readRefValue(vm, v);
    if (isList(dv)) {
      // Deep-copy list referenced by handle directly from memory, then pop handle
      const hAddr = getByteAddressFromRef(v);
      copyListAtHeader(vm, dv, hAddr);
      pop(vm);
      return;
    }
    // Simple alias: copy resolved value and pop original handle
    pushSimpleToGlobalHeap(vm, dv);
    pop(vm);
    return;
  }
  // Case 1: direct LIST on stack — copy payload+header using stack layout
  if (isList(v)) {
    // Ensure header and its payload are actually present on the data stack
    validateListHeader(vm);
    const h = v;
    const hAddr = (vm.sp - 1) * CELL_SIZE;
    copyListAtHeader(vm, h, hAddr);
    dropList(vm);
    return;
  }

  // Case 2: any non-LIST value — copy the single cell value and pop once
  pushSimpleToGlobalHeap(vm, v);
  pop(vm);
}

export function gpeekOp(vm: VM): void {
  if (vm.gp === 0) {
    throw new Error('gpeek on empty heap');
  }
  const topCell = GLOBAL_BASE_CELLS + (vm.gp - 1);
  const ref = createGlobalRef(topCell - GLOBAL_BASE_CELLS);
  push(vm, ref);
  fetchOp(vm);
}

export function gpopOp(vm: VM): void {
  if (vm.gp === 0) {
    throw new Error('gpop on empty heap');
  }
  const gBase = GLOBAL_BASE_CELLS;
  const topCell = gBase + vm.gp - 1;
  // Read header via unified data segment (absolute byte offset)
  const headerValue = vm.memory.readFloat32(SEG_DATA, topCell * CELL_SIZE);
  if (isList(headerValue)) {
    const spanCells = getListLength(headerValue) + 1;
    vm.gp -= spanCells;
    return;
  }
  vm.gp = vm.gp - 1;
}

// New ops: markOp/forgetOp — heap marks using REF handles
export function markOp(vm: VM): void {
  // Push a global REF that encodes the current GP (next free global cell)
  const ref = createGlobalRef(vm.gp);
  push(vm, ref);
}

export function forgetOp(vm: VM): void {
  ensureStackSize(vm, 1, 'forget');
  const ref = pop(vm);
  if (!isRef(ref)) {
    throw new Error('forget expects REF');
  }
  const absIndex = getAbsoluteCellIndexFromRef(ref);
  const gBase = GLOBAL_BASE_CELLS;
  const gpNew = absIndex - gBase;
  if (!Number.isInteger(gpNew) || gpNew < 0) {
    throw new Error('forget mark out of range');
  }
  if (gpNew > vm.gp) {
    throw new Error('forget mark beyond current heap top');
  }
  vm.gp = gpNew;
}

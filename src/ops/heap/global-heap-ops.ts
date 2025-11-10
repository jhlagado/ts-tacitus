/**
 * @file src/ops/heap/global-heap-ops.ts
 * Implements Tacit global heap primitives (gpush, gpop, gpeek).
 */

import {
  type VM,
  GLOBAL_BASE,
  CELL_SIZE,
  dropList,
  isList,
  getListLength,
  gpushListFrom,
  gpushVal,
  isRef,
  readRefValue,
  getByteAddressFromRef,
  validateListHeader,
  createGlobalRef,
  getCellFromRef,
} from '@src/core';
import { fetchOp } from '../lists';
import { push, pop, peek, ensureStackSize } from '../../core/vm';
// createGlobalRef now imported from core in the line above

// No reference validation helpers needed in the simplified model

function copyListAtHeader(vm: VM, h: number, hdr: number): void {
  const n = getListLength(h);
  const base = hdr - n;
  gpushListFrom(vm, { header: h, baseCell: base });
}

export function gpushOp(vm: VM): void {
  ensureStackSize(vm, 1, 'gpush');
  // If TOS is a ref: deep-copy list directly; for simples, copy resolved value now
  const v = peek(vm);
  if (isRef(v)) {
    const dv = readRefValue(vm, v);
    if (isList(dv)) {
      const hdr = getCellFromRef(v);
      copyListAtHeader(vm, dv, hdr);
      pop(vm);
      return;
    }
    // Simple alias: copy resolved value and pop original handle
    gpushVal(vm, dv);
    pop(vm);
    return;
  }
  // Case 1: direct LIST on stack — copy payload+header using stack layout
  if (isList(v)) {
    validateListHeader(vm);
    const h = v;
    const hdr = vm.sp - 1;
    copyListAtHeader(vm, h, hdr);
    dropList(vm);
    return;
  }

  // Case 2: any non-LIST value — copy the single cell value and pop once
  gpushVal(vm, v);
  pop(vm);
}

export function gpeekOp(vm: VM): void {
  if (vm.gp === 0) {
    throw new Error('gpeek on empty heap');
  }
  const top = GLOBAL_BASE + (vm.gp - 1);
  const ref = createGlobalRef(top - GLOBAL_BASE);
  push(vm, ref);
  fetchOp(vm);
}

export function gpopOp(vm: VM): void {
  if (vm.gp === 0) {
    throw new Error('gpop on empty heap');
  }
  const top = GLOBAL_BASE + vm.gp - 1;
  const h = vm.memory.readCell(top);
  if (isList(h)) {
    const span = getListLength(h) + 1;
    vm.gp -= span;
    return;
  }
  vm.gp -= 1;
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
  const idx = getCellFromRef(ref);
  const gpNew = idx - GLOBAL_BASE;
  if (!Number.isInteger(gpNew) || gpNew < 0) {
    throw new Error('forget mark out of range');
  }
  if (gpNew > vm.gp) {
    throw new Error('forget mark beyond current heap top');
  }
  vm.gp = gpNew;
}

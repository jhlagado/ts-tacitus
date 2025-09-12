/**
 * @file src/ops/broadcast.ts
 * Flat (non-nested) broadcasting helpers for unary and binary numeric builtins.
 *
 * NOTE: Phase 1 implements flat lists only. Nested list recursion can be added
 * behind these helpers without touching individual op implementations.
 */

import { VM } from '@src/core';
import { isList, getListLength } from '@src/core';
import { toTaggedValue, Tag } from '@src/core';

type NumberOp1 = (x: number) => number;
type NumberOp2 = (a: number, b: number) => number;

function popFlatListToArray(vm: VM): number[] {
  const header = vm.pop();
  const slots = getListLength(header);
  const arr: number[] = new Array(slots);
  for (let i = 0; i < slots; i++) {
    arr[i] = vm.pop();
  }
  return arr; // element order e0..e(n-1)
}

function pushFlatListFromArray(vm: VM, arr: number[]): void {
  const n = arr.length;
  for (let i = n - 1; i >= 0; i--) vm.push(arr[i]);
  vm.push(toTaggedValue(n, Tag.LIST));
}

export function unaryFlat(vm: VM, opName: string, f: NumberOp1): void {
  vm.ensureStackSize(1, opName);
  if (isList(vm.peek())) {
    const xs = popFlatListToArray(vm);
    if (xs.length === 0) {
      pushFlatListFromArray(vm, xs);
      return;
    }
    for (let i = 0; i < xs.length; i++) xs[i] = f(xs[i]);
    pushFlatListFromArray(vm, xs);
    return;
  }
  const x = vm.pop();
  vm.push(f(x));
}

export function binaryFlat(vm: VM, opName: string, f: NumberOp2): void {
  vm.ensureStackSize(2, opName);

  // If top is a list → pop it first (that's RHS b)
  if (isList(vm.peek())) {
    const bArr = popFlatListToArray(vm);
    if (isList(vm.peek())) {
      // list × list with cycle-to-match
      const aArr = popFlatListToArray(vm);
      const m = aArr.length;
      const n = bArr.length;
      const L = m > n ? m : n;
      if (L === 0) {
        pushFlatListFromArray(vm, []);
        return;
      }
      const out: number[] = new Array(L);
      for (let i = 0; i < L; i++) out[i] = f(aArr[i % m], bArr[i % n]);
      pushFlatListFromArray(vm, out);
      return;
    }
    // simple × list (scalar extension over bArr)
    const a = vm.pop();
    if (bArr.length === 0) {
      pushFlatListFromArray(vm, bArr);
      return;
    }
    for (let i = 0; i < bArr.length; i++) bArr[i] = f(a, bArr[i]);
    pushFlatListFromArray(vm, bArr);
    return;
  }

  // Top is simple; if below is a list → list × simple
  const b = vm.pop();
  if (isList(vm.peek())) {
    const aArr = popFlatListToArray(vm);
    if (aArr.length === 0) {
      pushFlatListFromArray(vm, aArr);
      return;
    }
    for (let i = 0; i < aArr.length; i++) aArr[i] = f(aArr[i], b);
    pushFlatListFromArray(vm, aArr);
    return;
  }

  // simple × simple
  const a = vm.pop();
  vm.push(f(a, b));
}

// -------- Recursive (nested) unary broadcasting --------

import { isNumber } from '@src/core';

function transformSlotsUnary(slots: number[], f: NumberOp1): number[] {
  const out: number[] = new Array(slots.length);
  let k = 0;
  while (k < slots.length) {
    const v = slots[k];
    if (isList(v)) {
      const s = getListLength(v);
      out[k] = v; // copy header unchanged
      if (s > 0) {
        const payload = slots.slice(k + 1, k + 1 + s);
        const rec = transformSlotsUnary(payload, f);
        for (let i = 0; i < s; i++) out[k + 1 + i] = rec[i];
      }
      k += s + 1;
    } else {
      if (!isNumber(v)) {
        throw new Error('broadcast type mismatch');
      }
      out[k] = f(v);
      k += 1;
    }
  }
  return out;
}

export function unaryRecursive(vm: VM, opName: string, f: NumberOp1): void {
  vm.ensureStackSize(1, opName);
  if (!isList(vm.peek())) {
    const x = vm.pop();
    if (!isNumber(x)) throw new Error('broadcast type mismatch');
    vm.push(f(x));
    return;
  }
  // Pop list into slots (index order), transform, then push back
  const header = vm.pop();
  const slots = getListLength(header);
  const popped: number[] = new Array(slots);
  for (let i = 0; i < slots; i++) popped[i] = vm.pop();
  // Convert to index order: slot0 near header is popped[slots-1]
  const payload: number[] = new Array(slots);
  for (let i = 0; i < slots; i++) payload[i] = popped[slots - 1 - i];
  const transformed = transformSlotsUnary(payload, f);
  // Push back in reverse (deep first), then header
  for (let i = slots - 1; i >= 0; i--) vm.push(transformed[i]);
  vm.push(header);
}

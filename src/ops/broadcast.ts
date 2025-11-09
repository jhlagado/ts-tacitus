/**
 * @file src/ops/broadcast.ts
 * Flat (non-nested) broadcasting helpers for unary and binary numeric builtins.
 *
 * NOTE: Phase 1 implements flat lists only. Nested list recursion can be added
 * behind these helpers without touching individual op implementations.
 */

import type { VM } from '@src/core';
import { isList, getListLength, toTaggedValue, Tag, SEG_DATA, STACK_BASE_BYTES, CELL_SIZE } from '@src/core';
import { pop, push, peek, ensureStackSize, depth } from '../core/vm';

type NumberOp1 = (x: number) => number;
type NumberOp2 = (a: number, b: number) => number;

function popFlatListToArray(vm: VM): number[] {
  const header = pop(vm);
  const slots = getListLength(header);
  const arr: number[] = new Array(slots);
  for (let i = 0; i < slots; i++) {
    arr[i] = pop(vm);
  }
  return arr; // element order e0..e(n-1)
}

function pushFlatListFromArray(vm: VM, arr: number[]): void {
  const n = arr.length;
  for (let i = n - 1; i >= 0; i--) {
push(vm, arr[i]);
}
  push(vm, toTaggedValue(n, Tag.LIST));
}

export function unaryFlat(vm: VM, opName: string, f: NumberOp1): void {
  ensureStackSize(vm, 1, opName);
  if (isList(peek(vm))) {
    const xs = popFlatListToArray(vm);
    if (xs.length === 0) {
      pushFlatListFromArray(vm, xs);
      return;
    }
    for (let i = 0; i < xs.length; i++) {
xs[i] = f(xs[i]);
}
    pushFlatListFromArray(vm, xs);
    return;
  }
  const x = pop(vm);
  push(vm, f(x));
}

export function binaryFlat(vm: VM, opName: string, f: NumberOp2): void {
  ensureStackSize(vm, 2, opName);

  // If top is a list → pop it first (that's RHS b)
  if (isList(peek(vm))) {
    const bArr = popFlatListToArray(vm);
    if (isList(peek(vm))) {
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
      for (let i = 0; i < L; i++) {
out[i] = f(aArr[i % m], bArr[i % n]);
}
      pushFlatListFromArray(vm, out);
      return;
    }
    // simple × list (scalar extension over bArr)
    const a = pop(vm);
    if (bArr.length === 0) {
      pushFlatListFromArray(vm, bArr);
      return;
    }
    for (let i = 0; i < bArr.length; i++) {
bArr[i] = f(a, bArr[i]);
}
    pushFlatListFromArray(vm, bArr);
    return;
  }

  // Top is simple; if below is a list → list × simple
  const b = pop(vm);
  if (isList(peek(vm))) {
    const aArr = popFlatListToArray(vm);
    if (aArr.length === 0) {
      pushFlatListFromArray(vm, aArr);
      return;
    }
    for (let i = 0; i < aArr.length; i++) {
aArr[i] = f(aArr[i], b);
}
    pushFlatListFromArray(vm, aArr);
    return;
  }

  // simple × simple
  const a = pop(vm);
  push(vm, f(a, b));
}

// Wrapper to prepare for nested recursion; currently delegates to flat.
export function binaryRecursive(vm: VM, opName: string, f: NumberOp2): void {
  ensureStackSize(vm, 2, opName);

  const isNum = (x: number) => isNumber(x);

  const popListSlots = (): number[] => {
    const header = pop(vm);
    const slots = getListLength(header);
    const payload: number[] = new Array(slots);
    for (let i = 0; i < slots; i++) {
payload[i] = pop(vm);
} // pops slot0,slot1,...
    const out: number[] = new Array(slots + 1);
    out[0] = header;
    // payload is already index-order (slot0..slotN-1)
    for (let i = 0; i < slots; i++) {
out[i + 1] = payload[i];
}
    return out; // [header, payload index-order]
  };

  const pushListSlots = (slotsArr: number[]) => {
    const header = slotsArr[0];
    const payloadLen = slotsArr.length - 1;
    // Push payload in index order so bottom→top reads [slot0 .. slotN-1, header]
    for (let i = 0; i < payloadLen; i++) {
push(vm, slotsArr[1 + i]);
}
    push(vm, header);
  };

  const enumerateElements = (slotsArr: number[]): { start: number; span: number }[] => {
    const total = getListLength(slotsArr[0]);
    const out: { start: number; span: number }[] = [];
    let remaining = total;
    let p = 1;
    while (remaining > 0) {
      const v = slotsArr[p];
      let span = 1;
      if (isList(v)) {
span = getListLength(v) + 1;
}
      out.push({ start: p, span });
      p += span;
      remaining -= span;
    }
    return out;
  };

  const transformScalarOverSlots = (
    scalar: number,
    listSlots: number[],
    left: boolean,
  ): number[] => {
    // listSlots: [header, payload...]
    const out: number[] = new Array(listSlots.length);
    out[0] = listSlots[0];
    const elems = enumerateElements(listSlots);
    let write = 1;
    for (const { start, span } of elems) {
      if (span === 1) {
        const v = listSlots[start];
        if (!isNum(v)) {
throw new Error('broadcast type mismatch');
}
        out[write++] = left ? f(scalar, v) : f(v, scalar);
      } else {
        const sub = listSlots.slice(start, start + span);
        const rec = transformScalarOverSlots(scalar, sub, left);
        for (let i = 0; i < rec.length; i++) {
out[write++] = rec[i];
}
      }
    }
    return out;
  };

  const transformBinarySlots = (aSlots: number[], bSlots: number[]): number[] => {
    const aElems = enumerateElements(aSlots);
    const bElems = enumerateElements(bSlots);
    const m = aElems.length;
    const n = bElems.length;
    if (m === 0 || n === 0) {
      return [toTaggedValue(0, Tag.LIST)];
    }
    const L = m > n ? m : n;
    // First pass to collect element results and total payload span
    const results: number[][] = new Array(L);
    let totalPayload = 0;
    for (let i = 0; i < L; i++) {
      const ea = aElems[i % m];
      const eb = bElems[i % n];
      const aSpan = ea.span;
      const bSpan = eb.span;
      let elemSlots: number[];
      if (aSpan === 1 && bSpan === 1) {
        const av = aSlots[ea.start];
        const bv = bSlots[eb.start];
        if (!isNum(av) || !isNum(bv)) {
throw new Error('broadcast type mismatch');
}
        elemSlots = [f(av, bv)];
      } else if (aSpan === 1 && bSpan > 1) {
        const av = aSlots[ea.start];
        if (!isNum(av)) {
throw new Error('broadcast type mismatch');
}
        const subB = bSlots.slice(eb.start, eb.start + bSpan);
        elemSlots = transformScalarOverSlots(av, subB, true);
      } else if (aSpan > 1 && bSpan === 1) {
        const bv = bSlots[eb.start];
        if (!isNum(bv)) {
throw new Error('broadcast type mismatch');
}
        const subA = aSlots.slice(ea.start, ea.start + aSpan);
        elemSlots = transformScalarOverSlots(bv, subA, false);
      } else {
        const subA = aSlots.slice(ea.start, ea.start + aSpan);
        const subB = bSlots.slice(eb.start, eb.start + bSpan);
        elemSlots = transformBinarySlots(subA, subB);
      }
      results[i] = elemSlots;
      totalPayload += elemSlots.length;
    }
    // Build output slots [header, payload...]
    const out: number[] = new Array(1 + totalPayload);
    out[0] = toTaggedValue(totalPayload, Tag.LIST);
    let write = 1;
    for (let i = 0; i < L; i++) {
      const r = results[i];
      for (let j = 0; j < r.length; j++) {
out[write++] = r[j];
}
    }
    return out;
  };

  // Dispatch based on top stack types
  if (isList(peek(vm))) {
    const bSlots = popListSlots();
    if (isList(peek(vm))) {
      const aSlots = popListSlots();
      const res = transformBinarySlots(aSlots, bSlots);
      pushListSlots(res);
      return;
    }
    const a = pop(vm);
    if (!isNum(a)) {
throw new Error('broadcast type mismatch');
}
    const res = transformScalarOverSlots(a, bSlots, true);
    pushListSlots(res);
    return;
  }

  const b = pop(vm);
  if (isList(peek(vm))) {
    if (!isNum(b)) {
throw new Error('broadcast type mismatch');
}
    const aSlots = popListSlots();
    const res = transformScalarOverSlots(b, aSlots, false);
    pushListSlots(res);
    return;
  }

  const a = pop(vm);
  if (!isNum(a) || !isNum(b)) {
throw new Error('broadcast type mismatch');
}
  push(vm, f(a, b));
}

// -------- Recursive (nested) unary broadcasting --------

import { isNumber } from '@src/core';
import { dupOp, nipOp } from './stack';

export function unaryRecursive(vm: VM, opName: string, f: NumberOp1): void {
  ensureStackSize(vm, 1, opName);
  if (!isList(peek(vm))) {
    const x = pop(vm);
    if (!isNumber(x)) {
throw new Error('broadcast type mismatch');
}
    push(vm, f(x));
    return;
  }

  // Duplicate the entire list block (payload + header) to top
  // then transform the top copy and remove the original (nip).
  dupOp(vm);

  // Transform the top copy in place using direct memory writes
  const headerAddr = (depth(vm) - 1) * CELL_SIZE;
  const headerVal = vm.memory.readFloat32(SEG_DATA, STACK_BASE_BYTES + headerAddr);
  const copySlots = getListLength(headerVal);
  for (let i = 0; i < copySlots; i++) {
    const cellAddr = headerAddr - (i + 1) * CELL_SIZE;
    const v = vm.memory.readFloat32(SEG_DATA, STACK_BASE_BYTES + cellAddr);
    if (isList(v)) {
continue;
} // leave headers untouched
    if (!isNumber(v)) {
throw new Error('broadcast type mismatch');
}
    vm.memory.writeFloat32(SEG_DATA, STACK_BASE_BYTES + cellAddr, f(v));
  }

  // Remove the original list under the transformed copy
  nipOp(vm);
}

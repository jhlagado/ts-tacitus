/**
 * @file src/ops/math/arithmetic-ops.ts
 * Mathematical operations for the Tacit VM.
 */

import type { VM, TacitWord } from '@src/core';
import { unaryRecursive, binaryRecursive } from '../broadcast';
import { push, pop, ensureStackSize } from '../../core/vm';
// no utils needed here; comparison ops live in comparison-ops.ts
export const addOp: TacitWord = (vm: VM) => {
  // Delegate to recursive helper (currently delegates to flat; future-proofed)
  binaryRecursive(vm, 'add', (a, b) => a + b);
};

export const subtractOp: TacitWord = (vm: VM) => {
  ensureStackSize(vm, 2, 'sub');
  const b = pop(vm);
  const a = pop(vm);
  push(vm, a - b);
};

export const multiplyOp: TacitWord = (vm: VM) => {
  ensureStackSize(vm, 2, 'mul');
  const b = pop(vm);
  const a = pop(vm);
  push(vm, a * b);
};

export const divideOp: TacitWord = (vm: VM) => {
  ensureStackSize(vm, 2, 'div');
  const b = pop(vm);
  const a = pop(vm);
  push(vm, a / b);
};

export const modOp: TacitWord = (vm: VM) => {
  ensureStackSize(vm, 2, 'mod');
  const b = pop(vm);
  const a = pop(vm);
  push(vm, a % b);
};

export const minOp: TacitWord = (vm: VM) => {
  ensureStackSize(vm, 2, 'min');
  const b = pop(vm);
  const a = pop(vm);
  push(vm, Math.min(a, b));
};

export const maxOp: TacitWord = (vm: VM) => {
  ensureStackSize(vm, 2, 'max');
  const b = pop(vm);
  const a = pop(vm);
  push(vm, Math.max(a, b));
};
export const absOp: TacitWord = (vm: VM) => {
  // Lift to unary broadcasting (handles simple and nested lists)
  unaryRecursive(vm, 'abs', a => Math.abs(a));
};

export const negOp: TacitWord = (vm: VM) => {
  unaryRecursive(vm, 'neg', a => -a);
};

export const signOp: TacitWord = (vm: VM) => {
  // Not listed in broadcasting spec set, keep simple fast path for now
  const a = pop(vm);
  push(vm, Math.sign(a));
};

export const expOp: TacitWord = (vm: VM) => {
  const a = pop(vm);
  push(vm, Math.exp(a));
};

export const lnOp: TacitWord = (vm: VM) => {
  const a = pop(vm);
  push(vm, Math.log(a));
};

export const logOp: TacitWord = (vm: VM) => {
  const a = pop(vm);
  push(vm, Math.log10(a));
};

export const sqrtOp: TacitWord = (vm: VM) => {
  const a = pop(vm);
  push(vm, Math.sqrt(a));
};

export const powOp: TacitWord = (vm: VM) => {
  ensureStackSize(vm, 2, 'pow');
  const b = pop(vm);
  const a = pop(vm);
  push(vm, a ** b);
};

export const recipOp: TacitWord = (vm: VM) => {
  const a = pop(vm);
  push(vm, 1 / a);
};

export const floorOp: TacitWord = (vm: VM) => {
  // Lift to unary broadcasting (handles simple and nested lists)
  unaryRecursive(vm, 'floor', a => Math.floor(a));
};

export const notOp: TacitWord = (vm: VM) => {
  // Lift to unary broadcasting (numeric truth domain: 0 -> 1, non-zero -> 0)
  unaryRecursive(vm, 'not', a => (a === 0 ? 1 : 0));
};

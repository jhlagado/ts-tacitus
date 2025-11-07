/**
 * @file src/ops/math/arithmetic-ops.ts
 * Mathematical operations for the Tacit VM.
 */

import type { VM, Verb } from '@src/core';
import { unaryRecursive, binaryRecursive } from '../broadcast';
// no utils needed here; comparison ops live in comparison-ops.ts
export const addOp: Verb = (vm: VM) => {
  // Delegate to recursive helper (currently delegates to flat; future-proofed)
  binaryRecursive(vm, 'add', (a, b) => a + b);
};

export const subtractOp: Verb = (vm: VM) => {
  vm.ensureStackSize(2, 'sub');
  const b = vm.pop();
  const a = vm.pop();
  vm.push(a - b);
};

export const multiplyOp: Verb = (vm: VM) => {
  vm.ensureStackSize(2, 'mul');
  const b = vm.pop();
  const a = vm.pop();
  vm.push(a * b);
};

export const divideOp: Verb = (vm: VM) => {
  vm.ensureStackSize(2, 'div');
  const b = vm.pop();
  const a = vm.pop();
  vm.push(a / b);
};

export const modOp: Verb = (vm: VM) => {
  vm.ensureStackSize(2, 'mod');
  const b = vm.pop();
  const a = vm.pop();
  vm.push(a % b);
};

export const minOp: Verb = (vm: VM) => {
  vm.ensureStackSize(2, 'min');
  const b = vm.pop();
  const a = vm.pop();
  vm.push(Math.min(a, b));
};

export const maxOp: Verb = (vm: VM) => {
  vm.ensureStackSize(2, 'max');
  const b = vm.pop();
  const a = vm.pop();
  vm.push(Math.max(a, b));
};
export const absOp: Verb = (vm: VM) => {
  // Lift to unary broadcasting (handles simple and nested lists)
  unaryRecursive(vm, 'abs', a => Math.abs(a));
};

export const negOp: Verb = (vm: VM) => {
  unaryRecursive(vm, 'neg', a => -a);
};

export const signOp: Verb = (vm: VM) => {
  // Not listed in broadcasting spec set, keep simple fast path for now
  const a = vm.pop();
  vm.push(Math.sign(a));
};

export const expOp: Verb = (vm: VM) => {
  const a = vm.pop();
  vm.push(Math.exp(a));
};

export const lnOp: Verb = (vm: VM) => {
  const a = vm.pop();
  vm.push(Math.log(a));
};

export const logOp: Verb = (vm: VM) => {
  const a = vm.pop();
  vm.push(Math.log10(a));
};

export const sqrtOp: Verb = (vm: VM) => {
  const a = vm.pop();
  vm.push(Math.sqrt(a));
};

export const powOp: Verb = (vm: VM) => {
  vm.ensureStackSize(2, 'pow');
  const b = vm.pop();
  const a = vm.pop();
  vm.push(a ** b);
};

export const recipOp: Verb = (vm: VM) => {
  const a = vm.pop();
  vm.push(1 / a);
};

export const floorOp: Verb = (vm: VM) => {
  // Lift to unary broadcasting (handles simple and nested lists)
  unaryRecursive(vm, 'floor', a => Math.floor(a));
};

export const notOp: Verb = (vm: VM) => {
  // Lift to unary broadcasting (numeric truth domain: 0 -> 1, non-zero -> 0)
  unaryRecursive(vm, 'not', a => (a === 0 ? 1 : 0));
};

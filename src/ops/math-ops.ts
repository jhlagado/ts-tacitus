/**
 * @file src/ops/math-ops.ts
 * Mathematical operations for the Tacit VM.
 */

import { VM } from '../core/vm';
import { Verb } from '../core/types';
export const addOp: Verb = (vm: VM) => {
  vm.ensureStackSize(2, 'add');
  const b = vm.pop();
  const a = vm.pop();
  vm.push(a + b);
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
export const equalOp: Verb = (vm: VM) => {
  vm.ensureStackSize(2, '=');
  const b = vm.pop();
  const a = vm.pop();
  vm.push(a === b ? 1 : 0);
};

export const lessThanOp: Verb = (vm: VM) => {
  vm.ensureStackSize(2, '<');
  const b = vm.pop();
  const a = vm.pop();
  vm.push(a < b ? 1 : 0);
};

export const lessOrEqualOp: Verb = (vm: VM) => {
  vm.ensureStackSize(2, '<=');
  const b = vm.pop();
  const a = vm.pop();
  vm.push(a <= b ? 1 : 0);
};

export const greaterThanOp: Verb = (vm: VM) => {
  vm.ensureStackSize(2, '>');
  const b = vm.pop();
  const a = vm.pop();
  vm.push(a > b ? 1 : 0);
};

export const greaterOrEqualOp: Verb = (vm: VM) => {
  vm.ensureStackSize(2, '>=');
  const b = vm.pop();
  const a = vm.pop();
  vm.push(a >= b ? 1 : 0);
};
export const absOp: Verb = (vm: VM) => {
  vm.ensureStackSize(1, 'abs');
  const a = vm.pop();
  vm.push(Math.abs(a));
};

export const negOp: Verb = (vm: VM) => {
  vm.ensureStackSize(1, 'neg');
  const a = vm.pop();
  vm.push(-a);
};

export const signOp: Verb = (vm: VM) => {
  vm.ensureStackSize(1, 'sign');
  const a = vm.pop();
  vm.push(Math.sign(a));
};

export const expOp: Verb = (vm: VM) => {
  vm.ensureStackSize(1, 'exp');
  const a = vm.pop();
  vm.push(Math.exp(a));
};

export const lnOp: Verb = (vm: VM) => {
  vm.ensureStackSize(1, 'ln');
  const a = vm.pop();
  vm.push(Math.log(a));
};

export const logOp: Verb = (vm: VM) => {
  vm.ensureStackSize(1, 'log');
  const a = vm.pop();
  vm.push(Math.log10(a));
};

export const sqrtOp: Verb = (vm: VM) => {
  vm.ensureStackSize(1, 'sqrt');
  const a = vm.pop();
  vm.push(Math.sqrt(a));
};

export const powOp: Verb = (vm: VM) => {
  vm.ensureStackSize(2, 'pow');
  const b = vm.pop();
  const a = vm.pop();
  vm.push(Math.pow(a, b));
};

export const recipOp: Verb = (vm: VM) => {
  vm.ensureStackSize(1, 'recip');
  const a = vm.pop();
  vm.push(1 / a);
};

export const floorOp: Verb = (vm: VM) => {
  vm.ensureStackSize(1, 'floor');
  const a = vm.pop();
  vm.push(Math.floor(a));
};

export const notOp: Verb = (vm: VM) => {
  vm.ensureStackSize(1, 'not');
  const a = vm.pop();
  vm.push(a === 0 ? 1 : 0);
};

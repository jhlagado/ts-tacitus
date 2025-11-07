import type { VM, Verb } from '@src/core';
import { areValuesEqual } from '@src/core';

export const equalOp: Verb = (vm: VM) => {
  vm.ensureStackSize(2, '=');
  const b = vm.pop();
  const a = vm.pop();
  vm.push(areValuesEqual(a, b) ? 1 : 0);
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

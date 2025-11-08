import type { VM, Verb } from '@src/core';
import { areValuesEqual } from '@src/core';
import { push, pop, ensureStackSize } from '../../core/vm';

export const equalOp: Verb = (vm: VM) => {
  ensureStackSize(vm, 2, '=');
  const b = pop(vm);
  const a = pop(vm);
  push(vm, areValuesEqual(a, b) ? 1 : 0);
};

export const lessThanOp: Verb = (vm: VM) => {
  ensureStackSize(vm, 2, '<');
  const b = pop(vm);
  const a = pop(vm);
  push(vm, a < b ? 1 : 0);
};

export const lessOrEqualOp: Verb = (vm: VM) => {
  ensureStackSize(vm, 2, '<=');
  const b = pop(vm);
  const a = pop(vm);
  push(vm, a <= b ? 1 : 0);
};

export const greaterThanOp: Verb = (vm: VM) => {
  ensureStackSize(vm, 2, '>');
  const b = pop(vm);
  const a = pop(vm);
  push(vm, a > b ? 1 : 0);
};

export const greaterOrEqualOp: Verb = (vm: VM) => {
  ensureStackSize(vm, 2, '>=');
  const b = pop(vm);
  const a = pop(vm);
  push(vm, a >= b ? 1 : 0);
};

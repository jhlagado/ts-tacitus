import type { VM, TacitWord } from '@src/core';
import { areValuesEqual } from '@src/core';
import { push, pop, ensureStackSize } from '../../core/vm';

export const equalOp: TacitWord = (vm: VM) => {
  ensureStackSize(vm, 2, '=');
  const b = pop(vm);
  const a = pop(vm);
  push(vm, areValuesEqual(a, b) ? 1 : 0);
};

export const lessThanOp: TacitWord = (vm: VM) => {
  ensureStackSize(vm, 2, '<');
  const b = pop(vm);
  const a = pop(vm);
  push(vm, a < b ? 1 : 0);
};

export const lessOrEqualOp: TacitWord = (vm: VM) => {
  ensureStackSize(vm, 2, '<=');
  const b = pop(vm);
  const a = pop(vm);
  push(vm, a <= b ? 1 : 0);
};

export const greaterThanOp: TacitWord = (vm: VM) => {
  ensureStackSize(vm, 2, '>');
  const b = pop(vm);
  const a = pop(vm);
  push(vm, a > b ? 1 : 0);
};

export const greaterOrEqualOp: TacitWord = (vm: VM) => {
  ensureStackSize(vm, 2, '>=');
  const b = pop(vm);
  const a = pop(vm);
  push(vm, a >= b ? 1 : 0);
};

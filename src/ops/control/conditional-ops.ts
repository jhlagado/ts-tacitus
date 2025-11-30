/**
 * Conditional control-flow helpers (branching primitives shared by immediates).
 */

import type { VM, TacitWord } from '@src/core';
import { isNumber } from '@src/core';
import { nextInt16, pop, ensureStackSize } from '../../core/vm';

/**
 * Implements the short-circuit branch used by the `if`/`when` family.
 *
 * Reads a 16-bit offset, consumes one stack value, and advances `ip` when the
 * condition is falsy (zero or non-numeric). Truthy numbers leave `ip` untouched
 * so execution falls through into the guarded body.
 */
export const ifFalseBranchOp: TacitWord = (vm: VM) => {
  const offset = nextInt16(vm);
  ensureStackSize(vm, 1, 'IF');
  const cond = pop(vm);
  if (!isNumber(cond) || cond === 0) {
    vm.ip += offset;
  }
};

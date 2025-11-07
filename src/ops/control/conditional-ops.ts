/**
 * Conditional control-flow helpers (branching primitives shared by immediates).
 */

import type { VM, Verb } from '@src/core';
import { isNumber } from '@src/core';
import { nextInt16 } from '../../core/vm';

/**
 * Implements the short-circuit branch used by the `if`/`when` family.
 *
 * Reads a 16-bit offset, consumes one stack value, and advances `IP` when the
 * condition is falsy (zero or non-numeric). Truthy numbers leave `IP` untouched
 * so execution falls through into the guarded body.
 */
export const ifFalseBranchOp: Verb = (vm: VM) => {
  const offset = nextInt16(vm);
  vm.ensureStackSize(1, 'IF');
  const cond = vm.pop();
  if (!isNumber(cond) || cond === 0) {
    vm.IP += offset;
  }
};

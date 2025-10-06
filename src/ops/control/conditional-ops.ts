/**
 * Conditional control-flow helpers (branching primitives shared by immediates).
 */

import { VM, Verb, isNumber } from '@src/core';

/**
 * Implements the short-circuit branch used by the `if`/`when` family.
 *
 * Reads a 16-bit offset, consumes one stack value, and advances `IP` when the
 * condition is falsy (zero or non-numeric). Truthy numbers leave `IP` untouched
 * so execution falls through into the guarded body.
 */
export const ifFalseBranchOp: Verb = (vm: VM) => {
  const offset = vm.nextInt16();
  vm.ensureStackSize(1, 'IF');
  const cond = vm.pop();
  if (!isNumber(cond) || cond === 0) {
    vm.IP += offset;
  }
};

/**
 * @file src/ops/control/branch-ops.ts
 *
 * This file implements conditional branching operations for the Tacit VM.
 *
 * Conditional operations allow for control flow based on runtime conditions.
 * The VM supports two main forms of conditionals:
 * 1. The modern IF { ... } ELSE { ... } syntax using conditional jumps
 * 2. The ternary-style if operation (simpleIfOp)
 *
 * Both approaches evaluate a condition and execute different code paths based on
 * whether the condition is truthy (non-zero) or falsy (zero).
 */

import { VM, Verb, isCode, isNumber, fromTaggedValue, toTaggedValue, Tag } from '@src/core';

/**
 * Implements a ternary if operator.
 *
 *
 * Takes three values from the stack:
 * - else-clause (top) - can be code block or a regular value
 * - then-clause (middle) - can be code block or a regular value
 * - condition (bottom) - must be a number
 *
 * If condition is truthy (non-zero):
 *   - If then-clause is code, it is executed
 *   - If then-clause is a regular value, it is pushed onto the stack
 * If condition is falsy (zero):
 *   - If else-clause is code, it is executed
 *   - If else-clause is a regular value, it is pushed onto the stack
 *
 * @param {VM} vm - The virtual machine instance.
 * @throws {Error} If the stack has fewer than 3 elements.
 * @throws {Error} If the condition is not a number.
 *
 * @example
 *
 *
 * simpleIfOp(vm)
 *
 *
 * @example
 *
 * simpleIfOp(vm)
 *
 *
 * @remarks
 * This operation is deprecated in favor of the more readable and efficient
 * IF { ... } ELSE { ... } syntax implemented by ifCurlyBranchFalseOp.
 */
export const simpleIfOp: Verb = (vm: VM) => {
  vm.ensureStackSize(3, 'if');

  const elseBranch = vm.pop();
  const thenBranch = vm.pop();
  const condition = vm.pop();
  if (!isNumber(condition)) {
    throw new Error(`Type error: 'if' condition must be a number, got: ${condition}`);
  }

  const selectedBranch = condition ? thenBranch : elseBranch;
  if (isCode(selectedBranch)) {
    vm.rpush(toTaggedValue(vm.IP, Tag.CODE));
    if (vm.frameBpInCells) {
      vm.rpush(vm.BPCells);
      vm.BPCells = vm.RSP;
    } else {
      vm.rpush(vm.BP);
      vm.BP = vm.RP; // BP remains byte-based; RP accessor provides bytes
    }
    const { value: pointer } = fromTaggedValue(selectedBranch);
    vm.IP = pointer;
  } else {
    vm.push(selectedBranch);
  }
};

/**
 * Implements the IF { ... } ELSE { ... } control structure using conditional jumps.
 *
 * This is the preferred way to write conditionals in Tacit. The operation works by
 * evaluating a condition and then either continuing execution or jumping forward
 * by a specified offset to skip the then-branch.
 *
 * The compiler generates the appropriate bytecode for the complete IF/ELSE structure,
 * including the necessary jump offsets.
 *
 * @param {VM} vm - The virtual machine instance.
 *
 * @example
 *
 *
 *
 *
 *
 *
 *
 *
 *
 * @example
 *
 *
 *
 *
 *
 *
 * @example
 *
 *
 *
 *
 *
 *
 * @example
 *
 *
 *
 *
 *
 *
 * @example
 *
 *
 *
 *
 *
 *
 * @example
 *
 *
 *
 *
 *
 *
 * @remarks
 * This operation consumes the condition value from the stack.
 * The offset to jump is encoded in the bytecode as a 16-bit value following
 * the operation code, retrieved using vm.nextInt16().
 *
 * If the condition is falsy (zero), the VM's instruction pointer (IP) is
 * incremented by the offset, effectively skipping the then-branch code.
 *
 * The ELSE block is optional. If omitted and the condition is false,
 * execution continues with the next instruction after the then-branch.
 *
 * Stack effect: ( cond -- )
 *
 * @see simpleIfOp The deprecated version of if-then-else
 */
export const ifCurlyBranchFalseOp: Verb = (vm: VM) => {
  const offset = vm.nextInt16();
  vm.ensureStackSize(1, 'IF');
  const cond = vm.pop();
  if (!isNumber(cond) || cond === 0) {
    vm.IP += offset;
  }
};

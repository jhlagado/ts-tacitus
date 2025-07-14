/**
 * @file src/ops/builtins-conditional.ts
 * 
 * This file implements conditional branching operations for the Tacit VM.
 * 
 * Conditional operations allow for control flow based on runtime conditions.
 * The VM supports two main forms of conditionals:
 * 1. The modern IF { ... } ELSE { ... } syntax using conditional jumps
 * 2. The legacy ternary-style if operation (deprecated)
 * 
 * Both approaches evaluate a condition and execute different code paths based on
 * whether the condition is truthy (non-zero) or falsy (zero).
 */

import { VM } from '../core/vm';
import { Verb } from '../core/types';

import { isCode, isNumber, fromTaggedValue, toTaggedValue, Tag } from '../core/tagged';

/**
 * Implements a ternary if operator (legacy version).
 * 
 * @deprecated Use the new IF { ... } ELSE { ... } syntax instead
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
 * // Example (old syntax - deprecated):
 * // Stack: [... 1 (10) (20)]
 * simpleIfOp(vm)
 * // Result: 10 is pushed or executed
 *
 * @example
 * // Stack: [... 0 (10) (20)]
 * simpleIfOp(vm)
 * // Result: 20 is pushed or executed
 *
 * @remarks
 * This operation is deprecated in favor of the more readable and efficient
 * IF { ... } ELSE { ... } syntax implemented by ifCurlyBranchFalseOp.
 */
export const simpleIfOp: Verb = (vm: VM) => {
  if (vm.SP < 3) {
    throw new Error(
      `Stack underflow: 'if' requires 3 operands (stack: ${JSON.stringify(vm.getStackData())})`,
    );
  }

  const elseBranch = vm.pop();
  const thenBranch = vm.pop();
  const condition = vm.pop();
  if (!isNumber(condition)) {
    throw new Error(`Type error: 'if' condition must be a number, got: ${condition}`);
  }

  const selectedBranch = condition ? thenBranch : elseBranch;
  if (isCode(selectedBranch)) {
    vm.rpush(toTaggedValue(vm.IP, Tag.CODE));
    vm.rpush(vm.BP);
    vm.BP = vm.RP;
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
 * // Source code: condition IF { then-branch } ELSE { else-branch }
 * // 
 * // Compiled bytecode structure (simplified):
 * // 1. Evaluate condition
 * // 2. ifCurlyBranchFalseOp with offset to else-branch
 * // 3. then-branch code
 * // 4. Jump past else-branch
 * // 5. else-branch code
 *
 * @example
 * // Source code: 1 IF { 10 }
 * // Stack before: [... 1]
 * // After condition evaluation: [... 1]
 * // After ifCurlyBranchFalseOp: [... ]
 * // After execution: [... 10]
 *
 * @example
 * // Source code: 0 IF { 10 }
 * // Stack before: [... 0]
 * // After condition evaluation: [... 0]
 * // After ifCurlyBranchFalseOp: [... ] (skips the then-branch)
 * // After execution: [... ] (nothing pushed)
 *
 * @example
 * // Source code: 1 IF { 10 } ELSE { 20 }
 * // Stack before: [... 1]
 * // After condition evaluation: [... 1]
 * // After ifCurlyBranchFalseOp: [... ]
 * // After execution: [... 10]
 *
 * @example
 * // Source code: 0 IF { 10 } ELSE { 20 }
 * // Stack before: [... 0]
 * // After condition evaluation: [... 0]
 * // After ifCurlyBranchFalseOp: [... ] (jumps to else-branch)
 * // After execution: [... 20]
 *
 * @example
 * // Source code: 5 3 > IF { "greater" } ELSE { "not greater" }
 * // Stack before: [... 5 3]
 * // After comparison: [... 1] (5 > 3 is true)
 * // After ifCurlyBranchFalseOp: [... ]
 * // After execution: [... "greater"]
 *
 * @remarks
 * This operation consumes the condition value from the stack.
 * The offset to jump is encoded in the bytecode as a 16-bit value following
 * the operation code, retrieved using vm.next16().
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
  const offset = vm.next16();
  const cond = vm.pop();
  if (!isNumber(cond) || cond === 0) {
    vm.IP += offset;
  }
};

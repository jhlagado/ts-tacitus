/**
 * @file src/ops/builtins-unary-op.ts
 * 
 * This file implements unary operations for the Tacit VM.
 * 
 * Unary operations are operations that take a single value from the stack,
 * perform some transformation on it, and push the result back onto the stack.
 * 
 * The operations in this file include:
 * - Mathematical unary operations: negation, reciprocal, floor, signum
 * - Logical operations: not
 * - List operations: enlist (convert a value to a single-element list)
 * 
 * All operations follow a consistent pattern:
 * 1. Pop one value from the stack
 * 2. Perform the unary operation
 * 3. Push the result back onto the stack
 */

import { VM } from '../core/vm';
import { Verb } from '../core/types';

import { toTaggedValue, Tag } from '../core/tagged';

/**
 * Implements the negation operation.
 * 
 * Pops a value from the stack, negates it (changes its sign), and pushes the result back.
 * 
 * @param {VM} vm - The virtual machine instance.
 * @throws {Error} If the stack is empty.
 * 
 * @example
 * // Stack before: [... 5]
 * mNegateOp(vm)
 * // Stack after: [... -5]
 * 
 * @example
 * // Stack before: [... -3]
 * mNegateOp(vm)
 * // Stack after: [... 3]
 */
export const mNegateOp: Verb = (vm: VM) => {
  if (vm.SP < 1) throw new Error(`Stack underflow: 'neg' requires 1 operand`);
  const a = vm.pop();
  vm.push(-a);
};

/**
 * Implements the reciprocal operation.
 * 
 * Pops a value from the stack, calculates its reciprocal (1/x), and pushes the result back.
 * 
 * @param {VM} vm - The virtual machine instance.
 * @throws {Error} If the stack is empty.
 * 
 * @example
 * // Stack before: [... 2]
 * mReciprocalOp(vm)
 * // Stack after: [... 0.5] (1/2)
 * 
 * @remarks
 * No explicit check for division by zero is performed. JavaScript will return
 * Infinity when dividing by zero, which is a valid floating-point value.
 */
export const mReciprocalOp: Verb = (vm: VM) => {
  if (vm.SP < 1) throw new Error(`Stack underflow: 'recip' requires 1 operand`);
  const a = vm.pop();
  vm.push(1 / a);
};

/**
 * Implements the floor operation.
 * 
 * Pops a value from the stack, rounds it down to the nearest integer,
 * and pushes the result back.
 * 
 * @param {VM} vm - The virtual machine instance.
 * @throws {Error} If the stack is empty.
 * 
 * @example
 * // Stack before: [... 3.7]
 * mFloorOp(vm)
 * // Stack after: [... 3]
 * 
 * @example
 * // Stack before: [... -2.3]
 * mFloorOp(vm)
 * // Stack after: [... -3] (rounds toward negative infinity)
 */
export const mFloorOp: Verb = (vm: VM) => {
  if (vm.SP < 1) throw new Error(`Stack underflow: 'floor' requires 1 operand`);
  const a = vm.pop();
  vm.push(Math.floor(a));
};

/**
 * Implements the logical NOT operation.
 * 
 * Pops a value from the stack, performs a logical negation (treating 0 as false
 * and any other value as true), and pushes the result back (1 for false, 0 for true).
 * 
 * @param {VM} vm - The virtual machine instance.
 * @throws {Error} If the stack is empty.
 * 
 * @example
 * // Stack before: [... 0]
 * mNotOp(vm)
 * // Stack after: [... 1] (NOT false = true)
 * 
 * @example
 * // Stack before: [... 5] (or any non-zero value)
 * mNotOp(vm)
 * // Stack after: [... 0] (NOT true = false)
 */
export const mNotOp: Verb = (vm: VM) => {
  if (vm.SP < 1) throw new Error(`Stack underflow: 'not' requires 1 operand`);
  const a = vm.pop();
  vm.push(a === 0 ? 1 : 0);
};

/**
 * Implements the signum (sign) operation.
 * 
 * Pops a value from the stack, determines its sign, and pushes the result back:
 * - 1 for positive values
 * - -1 for negative values
 * - 0 for zero
 * 
 * @param {VM} vm - The virtual machine instance.
 * @throws {Error} If the stack is empty.
 * 
 * @example
 * // Stack before: [... 42]
 * mSignumOp(vm)
 * // Stack after: [... 1] (positive)
 * 
 * @example
 * // Stack before: [... -7]
 * mSignumOp(vm)
 * // Stack after: [... -1] (negative)
 * 
 * @example
 * // Stack before: [... 0]
 * mSignumOp(vm)
 * // Stack after: [... 0] (zero)
 */
export const mSignumOp: Verb = (vm: VM) => {
  if (vm.SP < 1) throw new Error(`Stack underflow: 'sign' requires 1 operand`);
  const a = vm.pop();
  if (a > 0) vm.push(1);
  else if (a < 0) vm.push(-1);
  else vm.push(0);
};

/**
 * Implements the enlist operation.
 * 
 * Pops a value from the stack and converts it into a single-element list.
 * This is done by pushing a LIST tag with size 1, followed by the original value.
 * 
 * @param {VM} vm - The virtual machine instance.
 * @throws {Error} If the stack is empty.
 * 
 * @example
 * // Stack before: [... 42]
 * mEnlistOp(vm)
 * // Stack after: [... LIST:1 42]
 * // This represents a list containing the single value 42
 * 
 * @remarks
 * Unlike the list creation with '(' and ')', this operation does not push a LINK tag,
 * as it's meant to be used as part of other operations that expect a list structure.
 */
export const mEnlistOp: Verb = (vm: VM) => {
  if (vm.SP < 1) throw new Error(`Stack underflow: 'enlist' requires 1 operand`);
  const a = vm.pop();
  vm.push(toTaggedValue(1, Tag.LIST));
  vm.push(a);
};

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
 *
 * mNegateOp(vm)
 *
 *
 * @example
 *
 * mNegateOp(vm)
 *
 */
export const mNegateOp: Verb = (vm: VM) => {
  vm.ensureStackSize(1, 'neg');
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
 *
 * mReciprocalOp(vm)
 *
 *
 * @remarks
 * No explicit check for division by zero is performed. JavaScript will return
 * Infinity when dividing by zero, which is a valid floating-point value.
 */
export const mReciprocalOp: Verb = (vm: VM) => {
  vm.ensureStackSize(1, 'recip');
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
 *
 * mFloorOp(vm)
 *
 *
 * @example
 *
 * mFloorOp(vm)
 *
 */
export const mFloorOp: Verb = (vm: VM) => {
  vm.ensureStackSize(1, 'floor');
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
 *
 * mNotOp(vm)
 *
 *
 * @example
 *
 * mNotOp(vm)
 *
 */
export const mNotOp: Verb = (vm: VM) => {
  vm.ensureStackSize(1, 'not');
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
 *
 * mSignumOp(vm)
 *
 *
 * @example
 *
 * mSignumOp(vm)
 *
 *
 * @example
 *
 * mSignumOp(vm)
 *
 */
export const mSignumOp: Verb = (vm: VM) => {
  vm.ensureStackSize(1, 'sign');
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
 *
 * mEnlistOp(vm)
 *
 *
 *
 * @remarks
 * Unlike the list creation with '(' and ')', this operation does not push a LINK tag,
 * as it's meant to be used as part of other operations that expect a list structure.
 */
export const mEnlistOp: Verb = (vm: VM) => {
  vm.ensureStackSize(1, 'enlist');
  const a = vm.pop();
  // LIST semantics: push value, then LIST header with slot count 1
  vm.push(a);
  vm.push(toTaggedValue(1, Tag.LIST));
};

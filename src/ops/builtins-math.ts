/**
 * @file src/ops/builtins-math.ts
 *
 * This file implements mathematical operations for the Tacit VM.
 *
 * These operations perform arithmetic calculations and comparisons on values from the stack.
 * The operations include:
 * - Basic arithmetic: addition, subtraction, multiplication, division
 * - Advanced arithmetic: power, modulo, min, max
 * - Comparison operations: equal, less than, greater than, etc.
 *
 * All operations follow a consistent pattern:
 * 1. Pop two values from the stack (b then a)
 * 2. Perform the mathematical operation (a op b)
 * 3. Push the result back onto the stack
 *
 * Comparison operations push 1 for true and 0 for false.
 */

import { VM } from '../core/vm';
import { Verb } from '../core/types';

/**
 * Implements the addition operation.
 *
 * Pops two values from the stack, adds them together, and pushes the result back.
 *
 * @param {VM} vm - The virtual machine instance.
 * @throws {Error} If the stack has fewer than 2 elements.
 *
 * @example
 *
 * addOp(vm)
 *
 */
export const addOp: Verb = (vm: VM) => {
  vm.ensureStackSize(2, 'add');
  const b = vm.pop();
  const a = vm.pop();
  vm.push(a + b);
};

/**
 * Implements the subtraction operation.
 *
 * Pops two values from the stack, subtracts the top value from the second value,
 * and pushes the result back.
 *
 * @param {VM} vm - The virtual machine instance.
 * @throws {Error} If the stack has fewer than 2 elements.
 *
 * @example
 *
 * subtractOp(vm)
 *
 */
export const subtractOp: Verb = (vm: VM) => {
  vm.ensureStackSize(2, '-');
  const b = vm.pop();
  const a = vm.pop();
  vm.push(a - b);
};

/**
 * Implements the multiplication operation.
 *
 * Pops two values from the stack, multiplies them together, and pushes the result back.
 *
 * @param {VM} vm - The virtual machine instance.
 * @throws {Error} If the stack has fewer than 2 elements.
 *
 * @example
 *
 * multiplyOp(vm)
 *
 */
export const multiplyOp: Verb = (vm: VM) => {
  vm.ensureStackSize(2, '*');
  const b = vm.pop();
  const a = vm.pop();
  vm.push(a * b);
};

/**
 * Implements the division operation.
 *
 * Pops two values from the stack, divides the second value by the top value,
 * and pushes the result back.
 *
 * @param {VM} vm - The virtual machine instance.
 * @throws {Error} If the stack has fewer than 2 elements.
 *
 * @example
 *
 * divideOp(vm)
 *
 *
 * @remarks
 * No explicit check for division by zero is performed. JavaScript will return
 * Infinity or NaN in such cases, which are valid floating-point values.
 */
export const divideOp: Verb = (vm: VM) => {
  vm.ensureStackSize(2, '/');
  const b = vm.pop();
  const a = vm.pop();
  vm.push(a / b);
};

/**
 * Implements the power (exponentiation) operation.
 *
 * Pops two values from the stack, raises the second value to the power of the top value,
 * and pushes the result back.
 *
 * @param {VM} vm - The virtual machine instance.
 * @throws {Error} If the stack has fewer than 2 elements.
 *
 * @example
 *
 * powerOp(vm)
 *
 */
export const powerOp: Verb = (vm: VM) => {
  vm.ensureStackSize(2, '^');
  const b = vm.pop();
  const a = vm.pop();
  vm.push(a ** b);
};

/**
 * Implements the modulo operation.
 *
 * Pops two values from the stack, computes the remainder of dividing the second value
 * by the top value, and pushes the result back.
 *
 * @param {VM} vm - The virtual machine instance.
 * @throws {Error} If the stack has fewer than 2 elements.
 *
 * @example
 *
 * modOp(vm)
 *
 */
export const modOp: Verb = (vm: VM) => {
  vm.ensureStackSize(2, 'mod');
  const b = vm.pop();
  const a = vm.pop();
  vm.push(a % b);
};

/**
 * Implements the minimum operation.
 *
 * Pops two values from the stack, finds the smaller one, and pushes the result back.
 *
 * @param {VM} vm - The virtual machine instance.
 * @throws {Error} If the stack has fewer than 2 elements.
 *
 * @example
 *
 * minOp(vm)
 *
 */
export const minOp: Verb = (vm: VM) => {
  vm.ensureStackSize(2, '&');
  const b = vm.pop();
  const a = vm.pop();
  vm.push(Math.min(a, b));
};

/**
 * Implements the maximum operation.
 *
 * Pops two values from the stack, finds the larger one, and pushes the result back.
 *
 * @param {VM} vm - The virtual machine instance.
 * @throws {Error} If the stack has fewer than 2 elements.
 *
 * @example
 *
 * maxOp(vm)
 *
 */
export const maxOp: Verb = (vm: VM) => {
  vm.ensureStackSize(2, '|');
  const b = vm.pop();
  const a = vm.pop();
  vm.push(Math.max(a, b));
};

/**
 * Implements the equality comparison operation.
 *
 * Pops two values from the stack, checks if they are equal, and pushes 1 (true)
 * or 0 (false) back onto the stack.
 *
 * @param {VM} vm - The virtual machine instance.
 * @throws {Error} If the stack has fewer than 2 elements.
 *
 * @example
 *
 * equalOp(vm)
 *
 *
 * @example
 *
 * equalOp(vm)
 *
 */
export const equalOp: Verb = (vm: VM) => {
  vm.ensureStackSize(2, 'eq');
  const b = vm.pop();
  const a = vm.pop();
  vm.push(a === b ? 1 : 0);
};

/**
 * Implements the less-than comparison operation.
 *
 * Pops two values from the stack, checks if the second value is less than the top value,
 * and pushes 1 (true) or 0 (false) back onto the stack.
 *
 * @param {VM} vm - The virtual machine instance.
 * @throws {Error} If the stack has fewer than 2 elements.
 *
 * @example
 *
 * lessThanOp(vm)
 *
 *
 * @example
 *
 * lessThanOp(vm)
 *
 */
export const lessThanOp: Verb = (vm: VM) => {
  vm.ensureStackSize(2, 'lt');
  const b = vm.pop();
  const a = vm.pop();
  vm.push(a < b ? 1 : 0);
};

/**
 * Implements the less-than-or-equal comparison operation.
 *
 * Pops two values from the stack, checks if the second value is less than or equal to the top value,
 * and pushes 1 (true) or 0 (false) back onto the stack.
 *
 * @param {VM} vm - The virtual machine instance.
 * @throws {Error} If the stack has fewer than 2 elements.
 *
 * @example
 *
 * lessOrEqualOp(vm)
 *
 *
 * @example
 *
 * lessOrEqualOp(vm)
 *
 */
export const lessOrEqualOp: Verb = (vm: VM) => {
  vm.ensureStackSize(2, 'le');
  const b = vm.pop();
  const a = vm.pop();
  vm.push(a <= b ? 1 : 0);
};

/**
 * Implements the greater-than comparison operation.
 *
 * Pops two values from the stack, checks if the second value is greater than the top value,
 * and pushes 1 (true) or 0 (false) back onto the stack.
 *
 * @param {VM} vm - The virtual machine instance.
 * @throws {Error} If the stack has fewer than 2 elements.
 *
 * @example
 *
 * greaterThanOp(vm)
 *
 *
 * @example
 *
 * greaterThanOp(vm)
 *
 */
export const greaterThanOp: Verb = (vm: VM) => {
  vm.ensureStackSize(2, 'gt');
  const b = vm.pop();
  const a = vm.pop();
  vm.push(a > b ? 1 : 0);
};

/**
 * Implements the greater-than-or-equal comparison operation.
 *
 * Pops two values from the stack, checks if the second value is greater than or equal to the top value,
 * and pushes 1 (true) or 0 (false) back onto the stack.
 *
 * @param {VM} vm - The virtual machine instance.
 * @throws {Error} If the stack has fewer than 2 elements.
 *
 * @example
 *
 * greaterOrEqualOp(vm)
 *
 *
 * @example
 *
 * greaterOrEqualOp(vm)
 *
 */
export const greaterOrEqualOp: Verb = (vm: VM) => {
  vm.ensureStackSize(2, 'ge');
  const b = vm.pop();
  const a = vm.pop();
  vm.push(a >= b ? 1 : 0);
};

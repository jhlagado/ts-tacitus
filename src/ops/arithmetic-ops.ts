/**
 * @file src/ops/arithmetic-ops.ts
 *
 * This file implements arithmetic operations for the Tacit VM.
 *
 * These operations perform mathematical calculations on values from the stack,
 * including basic arithmetic, trigonometric functions, and statistical operations.
 *
 * Most operations follow a consistent pattern:
 * 1. Pop one or more values from the stack
 * 2. Perform the mathematical operation
 * 3. Push the result back onto the stack
 *
 * Note: While the comments mention array operations, the current implementations
 * only handle scalar (number) values directly. Array operations would require
 * additional logic to handle tagged values and lists.
 */

import { VM } from '../core/vm';
import { Verb } from '../core/types';

/**
 * Implements the absolute value operation.
 *
 * Pops a value from the stack, computes its absolute value, and pushes the result back.
 *
 * @param {VM} vm - The virtual machine instance.
 * @example
 *
 * absOp(vm)
 *
 *
 * @remarks
 * - For numbers: Returns the absolute value.
 * - For arrays: Would apply element-wise (not implemented).
 * - For strings: Not applicable.
 */
export const absOp: Verb = (vm: VM) => {
  vm.ensureStackSize(1, 'abs');
  const a = vm.pop();
  if (vm.debug) console.log('absOp', a);
  vm.push(Math.abs(a));
};

/**
 * Implements the negation operation (flips the sign).
 *
 * Pops a value from the stack, negates it, and pushes the result back.
 *
 * @param {VM} vm - The virtual machine instance.
 * @example
 *
 * negOp(vm)
 *
 *
 * @remarks
 * - For numbers: Returns the negated value.
 * - For arrays: Would apply element-wise (not implemented).
 * - For strings: Not applicable.
 */
export const negOp: Verb = (vm: VM) => {
  vm.ensureStackSize(1, 'neg');
  const a = vm.pop();
  if (vm.debug) console.log('negOp', a);
  vm.push(-a);
};

/**
 * Implements the sign function.
 *
 * Pops a value from the stack, determines its sign, and pushes the result back.
 * Returns -1 for negative values, 0 for zero, and 1 for positive values.
 *
 * @param {VM} vm - The virtual machine instance.
 * @example
 *
 * signOp(vm)
 *
 *
 * @remarks
 * - For numbers: Returns -1, 0, or 1.
 * - For arrays: Would apply element-wise (not implemented).
 * - For strings: Not applicable.
 */
export const signOp: Verb = (vm: VM) => {
  vm.ensureStackSize(1, 'sign');
  const a = vm.pop();
  if (vm.debug) console.log('signOp', a);
  vm.push(Math.sign(a));
};

/**
 * Implements the exponential function (e^x).
 *
 * Pops a value from the stack, computes e raised to that power, and pushes the result back.
 *
 * @param {VM} vm - The virtual machine instance.
 * @example
 *
 * expOp(vm)
 *
 *
 * @remarks
 * - For numbers: Returns e^x.
 * - For arrays: Would apply element-wise (not implemented).
 * - For strings: Not applicable.
 */
export const expOp: Verb = (vm: VM) => {
  vm.ensureStackSize(1, 'exp');
  const a = vm.pop();
  if (vm.debug) console.log('expOp', a);
  vm.push(Math.exp(a));
};

/**
 * Implements the natural logarithm function (ln).
 *
 * Pops a value from the stack, computes its natural logarithm, and pushes the result back.
 *
 * @param {VM} vm - The virtual machine instance.
 * @example
 *
 * lnOp(vm)
 *
 *
 * @remarks
 * - For numbers: Returns the natural logarithm (base e).
 * - For arrays: Would apply element-wise (not implemented).
 * - For strings: Not applicable.
 */
export const lnOp: Verb = (vm: VM) => {
  vm.ensureStackSize(1, 'ln');
  const a = vm.pop();
  if (vm.debug) console.log('lnOp', a);
  vm.push(Math.log(a));
};

/**
 * Implements the base-10 logarithm function.
 *
 * Pops a value from the stack, computes its base-10 logarithm, and pushes the result back.
 *
 * @param {VM} vm - The virtual machine instance.
 * @example
 *
 * logOp(vm)
 *
 *
 * @remarks
 * - For numbers: Returns the base-10 logarithm.
 * - For arrays: Would apply element-wise (not implemented).
 * - For strings: Not applicable.
 */
export const logOp: Verb = (vm: VM) => {
  vm.ensureStackSize(1, 'log');
  const a = vm.pop();
  if (vm.debug) console.log('logOp', a);
  vm.push(Math.log10(a));
};

/**
 * Implements the square root function.
 *
 * Pops a value from the stack, computes its square root, and pushes the result back.
 *
 * @param {VM} vm - The virtual machine instance.
 * @example
 *
 * sqrtOp(vm)
 *
 *
 * @remarks
 * - For numbers: Returns the square root.
 * - For arrays: Would apply element-wise (not implemented).
 * - For strings: Not applicable.
 */
export const sqrtOp: Verb = (vm: VM) => {
  vm.ensureStackSize(1, 'sqrt');
  const a = vm.pop();
  if (vm.debug) console.log('sqrtOp', a);
  vm.push(Math.sqrt(a));
};

/**
 * Implements the power operation (x^y).
 *
 * Pops two values from the stack (y then x), computes x raised to the power of y,
 * and pushes the result back.
 *
 * @param {VM} vm - The virtual machine instance.
 * @example
 *
 * powOp(vm)
 *
 *
 * @remarks
 * - For numbers: Computes x^y.
 * - For array-scalar: Would apply scalar to each element (not implemented).
 * - For array-array: Would apply element-wise (not implemented).
 * - For strings: Not applicable.
 */
export const powOp: Verb = (vm: VM) => {
  vm.ensureStackSize(2, 'pow');
  const b = vm.pop();
  const a = vm.pop();
  if (vm.debug) console.log('powOp', a, b);
  vm.push(Math.pow(a, b));
};

/**
 * Implements the minimum operation.
 *
 * Pops two values from the stack, finds the smaller one, and pushes the result back.
 *
 * @param {VM} vm - The virtual machine instance.
 * @example
 *
 * minOp(vm)
 *
 *
 * @remarks
 * - For numbers: Returns the smaller number.
 * - For array-scalar: Would compare each element to scalar (not implemented).
 * - For array-array: Would apply element-wise (not implemented).
 * - For strings: Not applicable.
 */
export const minOp: Verb = (vm: VM) => {
  vm.ensureStackSize(2, 'min');
  const b = vm.pop();
  const a = vm.pop();
  if (vm.debug) console.log('minOp', a, b);
  vm.push(Math.min(a, b));
};

/**
 * Implements the maximum operation.
 *
 * Pops two values from the stack, finds the larger one, and pushes the result back.
 *
 * @param {VM} vm - The virtual machine instance.
 * @example
 *
 * maxOp(vm)
 *
 *
 * @remarks
 * - For numbers: Returns the larger number.
 * - For array-scalar: Would compare each element to scalar (not implemented).
 * - For array-array: Would apply element-wise (not implemented).
 * - For strings: Not applicable.
 */
export const maxOp: Verb = (vm: VM) => {
  vm.ensureStackSize(2, 'max');
  const b = vm.pop();
  const a = vm.pop();
  if (vm.debug) console.log('maxOp', a, b);
  vm.push(Math.max(a, b));
};

/**
 * Implements the average (mean) operation.
 *
 * Pops two values from the stack, computes their average, and pushes the result back.
 *
 * @param {VM} vm - The virtual machine instance.
 * @example
 *
 * avgOp(vm)
 *
 *
 * @remarks
 * - For numbers: Computes (x + y)/2.
 * - For arrays: Would compute average of all elements (not implemented).
 * - For strings: Not applicable.
 */
export const avgOp: Verb = (vm: VM) => {
  vm.ensureStackSize(2, 'avg');
  const b = vm.pop();
  const a = vm.pop();
  if (vm.debug) console.log('avgOp', a, b);
  vm.push((a + b) / 2);
};

/**
 * Implements the product operation.
 *
 * Pops two values from the stack, computes their product, and pushes the result back.
 *
 * @param {VM} vm - The virtual machine instance.
 * @example
 *
 * prodOp(vm)
 *
 *
 * @remarks
 * - For numbers: Computes x*y.
 * - For arrays: Would compute product of all elements (not implemented).
 * - For strings: Not applicable.
 */
export const prodOp: Verb = (vm: VM) => {
  vm.ensureStackSize(2, 'prod');
  const b = vm.pop();
  const a = vm.pop();
  if (vm.debug) console.log('prodOp', a, b);
  vm.push(a * b);
};

/**
 * @file src/ops/math-ops.ts
 * Consolidated mathematical operations for the Tacit VM.
 * 
 * This file consolidates all mathematical functionality:
 * - Basic arithmetic: add, sub, mul, div (from builtins-math.ts)
 * - Comparisons: eq, lt, gt, le, ge (from builtins-math.ts)  
 * - Advanced math: abs, exp, ln, sqrt, etc. (from arithmetic-ops.ts)
 * - Unary operations: negate, reciprocal, floor, not (from builtins-unary-op.ts)
 * 
 * All operations follow stack-based patterns appropriate for a Forth VM.
 */

import { VM } from '../core/vm';
import { Verb } from '../core/types';

// ============================================================================
// BASIC ARITHMETIC OPERATIONS (from builtins-math.ts)
// ============================================================================

/**
 * Implements the addition operation.
 * Pops two values from the stack, adds them together, and pushes the result back.
 */
export const addOp: Verb = (vm: VM) => {
  vm.ensureStackSize(2, 'add');
  const b = vm.pop();
  const a = vm.pop();
  vm.push(a + b);
};

/**
 * Implements the subtraction operation.
 * Pops two values from the stack, subtracts the top value from the second value.
 */
export const subtractOp: Verb = (vm: VM) => {
  vm.ensureStackSize(2, 'sub');
  const b = vm.pop();
  const a = vm.pop();
  vm.push(a - b);
};

/**
 * Implements the multiplication operation.
 * Pops two values from the stack, multiplies them, and pushes the result back.
 */
export const multiplyOp: Verb = (vm: VM) => {
  vm.ensureStackSize(2, 'mul');
  const b = vm.pop();
  const a = vm.pop();
  vm.push(a * b);
};

/**
 * Implements the division operation.
 * Pops two values from the stack, divides the second by the first.
 */
export const divideOp: Verb = (vm: VM) => {
  vm.ensureStackSize(2, 'div');
  const b = vm.pop();
  const a = vm.pop();
  vm.push(a / b);
};

/**
 * Implements the power operation.
 * Pops two values from the stack, raises the second to the power of the first.
 */
export const powerOp: Verb = (vm: VM) => {
  vm.ensureStackSize(2, 'pow');
  const b = vm.pop();
  const a = vm.pop();
  vm.push(Math.pow(a, b));
};

/**
 * Implements the modulo operation.
 * Pops two values from the stack, computes the modulo.
 */
export const modOp: Verb = (vm: VM) => {
  vm.ensureStackSize(2, 'mod');
  const b = vm.pop();
  const a = vm.pop();
  vm.push(a % b);
};

/**
 * Implements the minimum operation.
 * Pops two values from the stack, finds the smaller one.
 */
export const minOp: Verb = (vm: VM) => {
  vm.ensureStackSize(2, '&');
  const b = vm.pop();
  const a = vm.pop();
  vm.push(Math.min(a, b));
};

/**
 * Implements the maximum operation.
 * Pops two values from the stack, finds the larger one.
 */
export const maxOp: Verb = (vm: VM) => {
  vm.ensureStackSize(2, '|');
  const b = vm.pop();
  const a = vm.pop();
  vm.push(Math.max(a, b));
};

// ============================================================================
// COMPARISON OPERATIONS (from builtins-math.ts)
// ============================================================================

/**
 * Implements the equality comparison operation.
 * Pops two values from the stack, compares them for equality.
 */
export const equalOp: Verb = (vm: VM) => {
  vm.ensureStackSize(2, '=');
  const b = vm.pop();
  const a = vm.pop();
  vm.push(a === b ? 1 : 0);
};

/**
 * Implements the less than comparison operation.
 */
export const lessThanOp: Verb = (vm: VM) => {
  vm.ensureStackSize(2, '<');
  const b = vm.pop();
  const a = vm.pop();
  vm.push(a < b ? 1 : 0);
};

/**
 * Implements the less than or equal comparison operation.
 */
export const lessOrEqualOp: Verb = (vm: VM) => {
  vm.ensureStackSize(2, '<=');
  const b = vm.pop();
  const a = vm.pop();
  vm.push(a <= b ? 1 : 0);
};

/**
 * Implements the greater than comparison operation.
 */
export const greaterThanOp: Verb = (vm: VM) => {
  vm.ensureStackSize(2, '>');
  const b = vm.pop();
  const a = vm.pop();
  vm.push(a > b ? 1 : 0);
};

/**
 * Implements the greater than or equal comparison operation.
 */
export const greaterOrEqualOp: Verb = (vm: VM) => {
  vm.ensureStackSize(2, '>=');
  const b = vm.pop();
  const a = vm.pop();
  vm.push(a >= b ? 1 : 0);
};

// ============================================================================
// ADVANCED MATH FUNCTIONS (from arithmetic-ops.ts)
// ============================================================================

/**
 * Implements the absolute value operation.
 * Pops a value from the stack, computes its absolute value.
 */
export const absOp: Verb = (vm: VM) => {
  vm.ensureStackSize(1, 'abs');
  const a = vm.pop();
  if (vm.debug) console.log('absOp', a);
  vm.push(Math.abs(a));
};

/**
 * Implements the negation operation (flips the sign).
 * Pops a value from the stack, negates it.
 */
export const negOp: Verb = (vm: VM) => {
  vm.ensureStackSize(1, 'neg');
  const a = vm.pop();
  if (vm.debug) console.log('negOp', a);
  vm.push(-a);
};

/**
 * Implements the sign function.
 * Returns -1 for negative values, 0 for zero, and 1 for positive values.
 */
export const signOp: Verb = (vm: VM) => {
  vm.ensureStackSize(1, 'sign');
  const a = vm.pop();
  if (vm.debug) console.log('signOp', a);
  vm.push(Math.sign(a));
};

/**
 * Implements the exponential function (e^x).
 * Pops a value from the stack, computes e raised to that power.
 */
export const expOp: Verb = (vm: VM) => {
  vm.ensureStackSize(1, 'exp');
  const a = vm.pop();
  if (vm.debug) console.log('expOp', a);
  vm.push(Math.exp(a));
};

/**
 * Implements the natural logarithm function (ln).
 * Pops a value from the stack, computes its natural logarithm.
 */
export const lnOp: Verb = (vm: VM) => {
  vm.ensureStackSize(1, 'ln');
  const a = vm.pop();
  if (vm.debug) console.log('lnOp', a);
  vm.push(Math.log(a));
};

/**
 * Implements the base-10 logarithm function.
 * Pops a value from the stack, computes its base-10 logarithm.
 */
export const logOp: Verb = (vm: VM) => {
  vm.ensureStackSize(1, 'log');
  const a = vm.pop();
  if (vm.debug) console.log('logOp', a);
  vm.push(Math.log10(a));
};

/**
 * Implements the square root function.
 * Pops a value from the stack, computes its square root.
 */
export const sqrtOp: Verb = (vm: VM) => {
  vm.ensureStackSize(1, 'sqrt');
  const a = vm.pop();
  if (vm.debug) console.log('sqrtOp', a);
  vm.push(Math.sqrt(a));
};

/**
 * Implements the power operation (x^y).
 * Note: This is similar to powerOp above but with debug logging.
 */
export const powOp: Verb = (vm: VM) => {
  vm.ensureStackSize(2, 'pow');
  const b = vm.pop();
  const a = vm.pop();
  if (vm.debug) console.log('powOp', a, b);
  vm.push(Math.pow(a, b));
};

/**
 * Implements the average (mean) operation.
 * Pops two values from the stack, computes their average.
 */
export const avgOp: Verb = (vm: VM) => {
  vm.ensureStackSize(2, 'avg');
  const b = vm.pop();
  const a = vm.pop();
  if (vm.debug) console.log('avgOp', a, b);
  vm.push((a + b) / 2);
};

/**
 * Implements the product operation for two values.
 * Pops two values from the stack, multiplies them (similar to multiplyOp).
 */
export const prodOp: Verb = (vm: VM) => {
  vm.ensureStackSize(2, 'prod');
  const b = vm.pop();
  const a = vm.pop();
  if (vm.debug) console.log('prodOp', a, b);
  vm.push(a * b);
};

// ============================================================================
// UNARY OPERATIONS (from builtins-unary-op.ts)
// ============================================================================

/**
 * Implements the negation operation (alias for consistency).
 * Pops a value from the stack and negates it.
 */
export const mNegateOp: Verb = (vm: VM) => {
  vm.ensureStackSize(1, 'neg');
  const a = vm.pop();
  vm.push(-a);
};

/**
 * Implements the reciprocal operation (1/x).
 * Pops a value from the stack and computes its reciprocal.
 */
export const mReciprocalOp: Verb = (vm: VM) => {
  vm.ensureStackSize(1, 'recip');
  const a = vm.pop();
  vm.push(1 / a);
};

/**
 * Implements the floor operation.
 * Pops a value from the stack and returns the largest integer less than or equal to it.
 */
export const mFloorOp: Verb = (vm: VM) => {
  vm.ensureStackSize(1, 'floor');
  const a = vm.pop();
  vm.push(Math.floor(a));
};

/**
 * Implements the logical not operation.
 * Returns 1 if the value is 0, otherwise returns 0.
 */
export const mNotOp: Verb = (vm: VM) => {
  vm.ensureStackSize(1, 'not');
  const a = vm.pop();
  vm.push(a === 0 ? 1 : 0);
};

/**
 * Implements the signum operation.
 * Returns -1 for negative, 0 for zero, 1 for positive.
 */
export const mSignumOp: Verb = (vm: VM) => {
  vm.ensureStackSize(1, 'signum');
  const a = vm.pop();
  vm.push(Math.sign(a));
};
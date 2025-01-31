import { VM } from "../vm";
import { Verb } from "../types";

/**
 * Equality check
 * Numbers: Checks if equal.
 * Strings: Checks if identical.
 * Arrays: Element-wise comparison.
 * Mixed types: Returns false.
 */
export const equalOp: Verb = (vm: VM) => {
  const b = vm.pop();
  const a = vm.pop();
  if (vm.debug) console.log("equalOp", a, b);
  vm.push(a === b ? 1 : 0);
};

/**
 * Not equal
 * Numbers: Checks if different.
 * Strings: Checks if not identical.
 * Arrays: Element-wise comparison.
 * Mixed types: Returns true.
 */
export const notEqualOp: Verb = (vm: VM) => {
  const b = vm.pop();
  const a = vm.pop();
  if (vm.debug) console.log("notEqualOp", a, b);
  vm.push(a !== b ? 1 : 0);
};

/**
 * Greater than
 * Numbers: Checks if left is greater.
 * Strings: Lexicographic comparison.
 * Arrays: Element-wise comparison.
 */
export const greaterThanOp: Verb = (vm: VM) => {
  const b = vm.pop();
  const a = vm.pop();
  if (vm.debug) console.log("greaterThanOp", a, b);
  vm.push(a > b ? 1 : 0);
};

/**
 * Less than
 * Numbers: Checks if left is smaller.
 * Strings: Lexicographic comparison.
 * Arrays: Element-wise comparison.
 */
export const lessThanOp: Verb = (vm: VM) => {
  const b = vm.pop();
  const a = vm.pop();
  if (vm.debug) console.log("lessThanOp", a, b);
  vm.push(a < b ? 1 : 0);
};

/**
 * Greater than or equal
 * Numbers: Checks if left is >= right.
 * Strings: Lexicographic comparison.
 * Arrays: Element-wise comparison.
 */
export const greaterThanOrEqualOp: Verb = (vm: VM) => {
  const b = vm.pop();
  const a = vm.pop();
  if (vm.debug) console.log("greaterThanOrEqualOp", a, b);
  vm.push(a >= b ? 1 : 0);
};

/**
 * Less than or equal
 * Numbers: Checks if left is <= right.
 * Strings: Lexicographic comparison.
 * Arrays: Element-wise comparison.
 */
export const lessThanOrEqualOp: Verb = (vm: VM) => {
  const b = vm.pop();
  const a = vm.pop();
  if (vm.debug) console.log("lessThanOrEqualOp", a, b);
  vm.push(a <= b ? 1 : 0);
};

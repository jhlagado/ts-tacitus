import { VM } from "../vm";
import { Verb } from "../types";
import { not, and, or, xor, toNumber } from "../utils";

/**
 * Logical negation
 * Boolean: Flips true/false.
 * Number: 0 becomes true (1), nonzero becomes false (0).
 * Array: Not applicable.
 * String: Not applicable.
 */
export const notOp: Verb = (vm: VM) => {
  const a = vm.pop();
  if (vm.debug) console.log("notOp", a);
  vm.push(not(a));
};

/**
 * Logical AND
 * Booleans: true (1) if both are true (1).
 * Numbers: Nonzero treated as true (1).
 * Array: Not applicable.
 * String: Not applicable.
 */
export const andOp: Verb = (vm: VM) => {
  const b = vm.pop();
  const a = vm.pop();
  if (vm.debug) console.log("andOp", a, b);
  vm.push(and(a, b));
};

/**
 * Logical OR
 * Booleans: true (1) if at least one is true (1).
 * Numbers: Nonzero treated as true (1).
 * Array: Not applicable.
 * String: Not applicable.
 */
export const orOp: Verb = (vm: VM) => {
  const b = vm.pop();
  const a = vm.pop();
  if (vm.debug) console.log("orOp", a, b);
  vm.push(or(a, b));
};

/**
 * Logical XOR
 * Booleans: true (1) if exactly one is true (1).
 * Numbers: Nonzero treated as true (1).
 * Array: Not applicable.
 * String: Not applicable.
 */
export const xorOp: Verb = (vm: VM) => {
  const b = vm.pop();
  const a = vm.pop();
  if (vm.debug) console.log("xorOp", a, b);
  vm.push(xor(a, b));
};

/**
 * Checks if any element is true (1)
 * Array: Not applicable.
 * Scalar: Equivalent to bool(x).
 */
export const anyOp: Verb = (vm: VM) => {
  const a = vm.pop();
  if (vm.debug) console.log("anyOp", a);
  vm.push(toNumber(!!a));
};

/**
 * Checks if all elements are true (1)
 * Array: Not applicable.
 * Scalar: Equivalent to bool(x).
 */
export const allOp: Verb = (vm: VM) => {
  const a = vm.pop();
  if (vm.debug) console.log("allOp", a);
  vm.push(toNumber(!!a));
};

/**
 * Element-wise comparison
 * Scalars: Returns true (1) if equal.
 * Arrays: Not applicable.
 * Strings: Not applicable.
 */
export const matchOp: Verb = (vm: VM) => {
  const b = vm.pop();
  const a = vm.pop();
  if (vm.debug) console.log("matchOp", a, b);
  vm.push(a === b ? 1 : 0);
};

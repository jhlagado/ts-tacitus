import { VM } from "../vm";
import { Verb } from "../types";

/**
 * Converts to string
 * Number: Converts to string.
 * Array: Converts elements.
 * Other: No effect.
 */
export const stringOp: Verb = (vm: VM) => {
  const a = vm.pop();
  if (vm.debug) console.log("stringOp", a);
  // Implementation here
};

/**
 * Extracts substring
 * String/Indices: Extracts portion.
 * Array/String: Element-wise substring.
 */
export const substringOp: Verb = (vm: VM) => {
  const indices = vm.pop();
  const str = vm.pop();
  if (vm.debug) console.log("substringOp", str, indices);
  // Implementation here
};

/**
 * Returns length of string/array
 * String: Returns character count.
 * Array: Returns item count.
 * Other: Error.
 */
export const lengthOp: Verb = (vm: VM) => {
  const a = vm.pop();
  if (vm.debug) console.log("lengthOp", a);
  // Implementation here
};

/**
 * Replaces substring
 * String/String: Replaces all occurrences.
 * Array: Element-wise replacement.
 * Other: Error.
 */
export const replaceOp: Verb = (vm: VM) => {
  const replacement = vm.pop();
  const str = vm.pop();
  if (vm.debug) console.log("replaceOp", str, replacement);
  // Implementation here
};

/**
 * Splits string by delimiter
 * String/String: Returns list of parts.
 * Array: Element-wise split.
 * Other: Error.
 */
export const splitOp: Verb = (vm: VM) => {
  const delimiter = vm.pop();
  const str = vm.pop();
  if (vm.debug) console.log("splitOp", str, delimiter);
  // Implementation here
};

/**
 * Concatenates strings/arrays
 * Array/String: Joins with separator.
 * String/String: Concatenation.
 * Other: Error.
 */
export const joinOp: Verb = (vm: VM) => {
  const separator = vm.pop();
  const arr = vm.pop();
  if (vm.debug) console.log("joinOp", arr, separator);
  // Implementation here
};

/**
 * Converts string to uppercase
 * String: Converts characters.
 * Array: Element-wise uppercase.
 * Other: Error.
 */
export const ucaseOp: Verb = (vm: VM) => {
  const a = vm.pop();
  if (vm.debug) console.log("ucaseOp", a);
  // Implementation here
};

/**
 * Converts string to lowercase
 * String: Converts characters.
 * Array: Element-wise lowercase.
 * Other: Error.
 */
export const lcaseOp: Verb = (vm: VM) => {
  const a = vm.pop();
  if (vm.debug) console.log("lcaseOp", a);
  // Implementation here
};

/**
 * Removes leading/trailing spaces
 * String: Trims whitespace.
 * Array: Element-wise trim.
 * Other: Error.
 */
export const trimOp: Verb = (vm: VM) => {
  const a = vm.pop();
  if (vm.debug) console.log("trimOp", a);
  // Implementation here
};

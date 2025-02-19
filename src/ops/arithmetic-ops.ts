import { VM } from "../core/vm";
import { Verb } from "../core/types";

/**
 * Absolute value
 * Number: Returns absolute value.
 * Array: Applies element-wise.
 * String: Not applicable.
 */
export const absOp: Verb = (vm: VM) => {
  const a = vm.pop();
  if (vm.debug) console.log("absOp", a);
  vm.push(Math.abs(a));
};

/**
 * Negation (flip sign)
 * Number: Returns negative.
 * Array: Applies element-wise.
 * String: Not applicable.
 */
export const negOp: Verb = (vm: VM) => {
  const a = vm.pop();
  if (vm.debug) console.log("negOp", a);
  vm.push(-a);
};

/**
 * Sign function (-1 for negative, 0 for zero, 1 for positive)
 * Number: Returns -1, 0, or 1.
 * Array: Applies element-wise.
 * String: Not applicable.
 */
export const signOp: Verb = (vm: VM) => {
  const a = vm.pop();
  if (vm.debug) console.log("signOp", a);
  vm.push(Math.sign(a));
};

/**
 * Exponential function (e^x)
 * Number: Returns e^x.
 * Array: Applies element-wise.
 * String: Not applicable.
 */
export const expOp: Verb = (vm: VM) => {
  const a = vm.pop();
  if (vm.debug) console.log("expOp", a);
  vm.push(Math.exp(a));
};

/**
 * Natural logarithm
 * Number: Returns log base e.
 * Array: Applies element-wise.
 * String: Not applicable.
 */
export const lnOp: Verb = (vm: VM) => {
  const a = vm.pop();
  if (vm.debug) console.log("lnOp", a);
  vm.push(Math.log(a));
};

/**
 * Logarithm base 10
 * Number: Returns log base 10.
 * Array: Applies element-wise.
 * String: Not applicable.
 */
export const logOp: Verb = (vm: VM) => {
  const a = vm.pop();
  if (vm.debug) console.log("logOp", a);
  vm.push(Math.log10(a));
};

/**
 * Square root
 * Number: Returns sqrt.
 * Array: Applies element-wise.
 * String: Not applicable.
 */
export const sqrtOp: Verb = (vm: VM) => {
  const a = vm.pop();
  if (vm.debug) console.log("sqrtOp", a);
  vm.push(Math.sqrt(a));
};

/**
 * Exponentiation (x^y)
 * Numbers: Computes x^y.
 * Array-Scalar: Applies scalar to each element.
 * Array-Array: Element-wise power.
 * String: Not applicable.
 */
export const powOp: Verb = (vm: VM) => {
  const b = vm.pop();
  const a = vm.pop();
  if (vm.debug) console.log("powOp", a, b);
  vm.push(Math.pow(a, b));
};

/**
 * Minimum of two values
 * Numbers: Returns smaller number.
 * Array-Scalar: Compares each element to scalar.
 * Array-Array: Element-wise min.
 * String: Not applicable.
 */
export const minOp: Verb = (vm: VM) => {
  const b = vm.pop();
  const a = vm.pop();
  if (vm.debug) console.log("minOp", a, b);
  vm.push(Math.min(a, b));
};

/**
 * Maximum of two values
 * Numbers: Returns larger number.
 * Array-Scalar: Compares each element to scalar.
 * Array-Array: Element-wise max.
 * String: Not applicable.
 */
export const maxOp: Verb = (vm: VM) => {
  const b = vm.pop();
  const a = vm.pop();
  if (vm.debug) console.log("maxOp", a, b);
  vm.push(Math.max(a, b));
};

/**
 * Mean (average) of two values
 * Numbers: Computes (x + y)/2.
 * Array: Computes average of all elements.
 * String: Not applicable.
 */
export const avgOp: Verb = (vm: VM) => {
  const b = vm.pop();
  const a = vm.pop();
  if (vm.debug) console.log("avgOp", a, b);
  vm.push((a + b) / 2);
};

/**
 * Product of elements
 * Numbers: Computes x*y.
 * Array: Computes product of all elements.
 * String: Not applicable.
 */
export const prodOp: Verb = (vm: VM) => {
  const b = vm.pop();
  const a = vm.pop();
  if (vm.debug) console.log("prodOp", a, b);
  vm.push(a * b);
};

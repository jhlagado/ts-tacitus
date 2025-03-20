import { VM } from "../vm";
import { Verb } from "../types";

/**
 * Generates random numbers
 * Monadic: Returns a random float (0-1).
 * Dyadic: Returns a random integer in range.
 */
export const randOp: Verb = (vm: VM) => {
  const b = vm.pop();
  if (vm.debug) console.log("randOp", b);
  // Implementation here
};

/**
 * Samples elements from array
 * Array/Count: Returns random subset.
 * Other: Error.
 */
export const sampleOp: Verb = (vm: VM) => {
  const count = vm.pop();
  const array = vm.pop();
  if (vm.debug) console.log("sampleOp", array, count);
  // Implementation here
};

/**
 * Randomly shuffles elements
 * Array: Returns shuffled copy.
 * String: Shuffles characters.
 * Other: Error.
 */
export const shuffleOp: Verb = (vm: VM) => {
  const a = vm.pop();
  if (vm.debug) console.log("shuffleOp", a);
  // Implementation here
};

/**
 * Generates uniform random numbers
 * Monadic: Returns a float (0-1).
 * Dyadic (a, b): Returns float in range [a, b].
 */
export const uniformOp: Verb = (vm: VM) => {
  const b = vm.pop();
  const a = vm.pop();
  if (vm.debug) console.log("uniformOp", a, b);
  // Implementation here
};

/**
 * Generates normally distributed numbers
 * Monadic: Returns N(0,1) random float.
 * Dyadic (μ, σ): Returns N(μ,σ) random float.
 */
export const normalOp: Verb = (vm: VM) => {
  const sigma = vm.pop();
  const mu = vm.pop();
  if (vm.debug) console.log("normalOp", mu, sigma);
  // Implementation here
};

/**
 * Samples with probability weights
 * Array/Weights: Returns random element.
 * Other: Error.
 */
export const weightedOp: Verb = (vm: VM) => {
  const weights = vm.pop();
  const array = vm.pop();
  if (vm.debug) console.log("weightedOp", array, weights);
  // Implementation here
};

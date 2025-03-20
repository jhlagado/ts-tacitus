import { VM } from "../vm";
import { Verb } from "../types";

/**
 * Conditional execution
 * Condition/Expression: Evaluates if 1.
 */
export const ifOp: Verb = (vm: VM) => {
  const expr = vm.pop();
  const condition = vm.pop();
  if (vm.debug) console.log("ifOp", condition, expr);
  // Implementation here
};

/**
 * Conditional branching
 * Condition/(Expr1, Expr2): Evaluates based on condition.
 */
export const ifElseOp: Verb = (vm: VM) => {
  const expr2 = vm.pop();
  const expr1 = vm.pop();
  const condition = vm.pop();
  if (vm.debug) console.log("ifElseOp", condition, expr1, expr2);
  // Implementation here
};

/**
 * Matches cases to values
 * Value/CaseDict: Returns matching case.
 */
export const switchOp: Verb = (vm: VM) => {
  const caseDict = vm.pop();
  const value = vm.pop();
  if (vm.debug) console.log("switchOp", value, caseDict);
  // Implementation here
};

/**
 * Executes first matching case
 * Conditions/Actions: Runs first true case.
 */
export const caseOp: Verb = (vm: VM) => {
  const actions = vm.pop();
  const conditions = vm.pop();
  if (vm.debug) console.log("caseOp", conditions, actions);
  // Implementation here
};

/**
 * Loop while condition holds
 * Condition/Body: Repeats while true.
 */
export const whileOp: Verb = (vm: VM) => {
  const body = vm.pop();
  const condition = vm.pop();
  if (vm.debug) console.log("whileOp", condition, body);
  // Implementation here
};

/**
 * Groups array by unique values
 * Array/KeyArray: Returns grouped structure.
 */
export const groupByOp: Verb = (vm: VM) => {
  const keyArray = vm.pop();
  const array = vm.pop();
  if (vm.debug) console.log("groupByOp", array, keyArray);
  // Implementation here
};

/**
 * Flattens grouped structure
 * Grouped Array: Returns flat list.
 */
export const ungroupOp: Verb = (vm: VM) => {
  const groupedArray = vm.pop();
  if (vm.debug) console.log("ungroupOp", groupedArray);
  // Implementation here
};

/**
 * Combines multiple arrays
 * Arrays: Returns single array.
 */
export const uniteOp: Verb = (vm: VM) => {
  const array2 = vm.pop();
  const array1 = vm.pop();
  if (vm.debug) console.log("uniteOp", array1, array2);
  // Implementation here
};

/**
 * Merges dictionaries/tables
 * Dict/Dict: Combines entries.
 * Table/Table: Joins tables.
 */
export const mergeOp: Verb = (vm: VM) => {
  const dict2 = vm.pop();
  const dict1 = vm.pop();
  if (vm.debug) console.log("mergeOp", dict1, dict2);
  // Implementation here
};

/**
 * Caches function results
 * Function: Returns memoized function.
 */
export const cacheOp: Verb = (vm: VM) => {
  const func = vm.pop();
  if (vm.debug) console.log("cacheOp", func);
  // Implementation here
};

/**
 * Runs function in parallel
 * Function: Enables parallel execution.
 */
export const parallelOp: Verb = (vm: VM) => {
  const func = vm.pop();
  if (vm.debug) console.log("parallelOp", func);
  // Implementation here
};

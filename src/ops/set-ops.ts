import { VM } from "../vm";
import { Verb } from "../types";

/**
 * Returns unique elements
 * Array: Removes duplicates.
 * String: Unique characters.
 * Scalar: No effect.
 */
export const distinctOp: Verb = (vm: VM) => {
  const a = vm.pop();
  if (vm.debug) console.log("distinctOp", a);
  // Implementation here
};

/**
 * Groups elements by value
 * Array: Returns index groups per unique value.
 * String: Not applicable.
 * Scalar: No effect.
 */
export const groupOp: Verb = (vm: VM) => {
  const a = vm.pop();
  if (vm.debug) console.log("groupOp", a);
  // Implementation here
};

/**
 * Converts grouped format back
 * Grouped data: Expands back into flat array.
 * Other: No effect.
 */
export const ungroupOp: Verb = (vm: VM) => {
  const a = vm.pop();
  if (vm.debug) console.log("ungroupOp", a);
  // Implementation here
};

/**
 * Modifies values in a dataset
 * First arg: Field to update.
 * Second arg: New values.
 * Array/Table: Updates field column-wise.
 * Scalar: No effect.
 */
export const updateOp: Verb = (vm: VM) => {
  const field = vm.pop();
  const newValues = vm.pop();
  if (vm.debug) console.log("updateOp", field, newValues);
  // Implementation here
};

/**
 * Removes values from a dataset
 * First arg: Field to delete.
 * Second arg: Condition.
 * Array/Table: Removes matching rows.
 * Scalar: No effect.
 */
export const deleteOp: Verb = (vm: VM) => {
  const field = vm.pop();
  const condition = vm.pop();
  if (vm.debug) console.log("deleteOp", field, condition);
  // Implementation here
};

/**
 * Adds new values to a dataset
 * First arg: Field to insert into.
 * Second arg: Values to insert.
 * Array/Table: Appends row-wise.
 * Scalar: No effect.
 */
export const insertOp: Verb = (vm: VM) => {
  const field = vm.pop();
  const values = vm.pop();
  if (vm.debug) console.log("insertOp", field, values);
  // Implementation here
};

/**
 * Adds a new computed field
 * First arg: New field name.
 * Second arg: Expression to compute.
 * Array/Table: Adds column-wise.
 * Scalar: No effect.
 */
export const extendOp: Verb = (vm: VM) => {
  const newField = vm.pop();
  const expression = vm.pop();
  if (vm.debug) console.log("extendOp", newField, expression);
  // Implementation here
};

/**
 * Merges two sets
 * Arrays: Combines unique elements.
 * Strings: Combines unique characters.
 * Scalars: No effect.
 */
export const unionOp: Verb = (vm: VM) => {
  const b = vm.pop();
  const a = vm.pop();
  if (vm.debug) console.log("unionOp", a, b);
  // Implementation here
};

/**
 * Finds common elements
 * Arrays: Returns shared elements.
 * Strings: Returns shared characters.
 * Scalars: No effect.
 */
export const intersectOp: Verb = (vm: VM) => {
  const b = vm.pop();
  const a = vm.pop();
  if (vm.debug) console.log("intersectOp", a, b);
  // Implementation here
};

/**
 * Elements in first set, not in second
 * Arrays: Returns difference.
 * Strings: Returns characters in first but not second.
 * Scalars: No effect.
 */
export const exceptOp: Verb = (vm: VM) => {
  const b = vm.pop();
  const a = vm.pop();
  if (vm.debug) console.log("exceptOp", a, b);
  // Implementation here
};

/**
 * Symmetric difference
 * Arrays: Elements in either but not both.
 * Strings: Applies to characters.
 * Scalars: No effect.
 */
export const symdiffOp: Verb = (vm: VM) => {
  const b = vm.pop();
  const a = vm.pop();
  if (vm.debug) console.log("symdiffOp", a, b);
  // Implementation here
};

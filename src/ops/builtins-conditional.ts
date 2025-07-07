import { VM } from '../core/vm';
import { Verb } from '../core/types';
import { isCode, isNumber, fromTaggedValue, toTaggedValue, Tag } from '../core/tagged';

/**
 * @deprecated Use the new IF { ... } ELSE { ... } syntax instead
 * 
 * Implements a ternary if operator
 * Takes three values from the stack:
 * - else-clause (top) - can be code block or a regular value
 * - then-clause (middle) - can be code block or a regular value
 * - condition (bottom) - must be a number
 *
 * If condition is truthy:
 *   - If then-clause is code, it is executed
 *   - If then-clause is a regular value, it is pushed onto the stack
 * If condition is falsy:
 *   - If else-clause is code, it is executed
 *   - If else-clause is a regular value, it is pushed onto the stack
 *
 * Example (old syntax - deprecated):
 *   1 (10) (20) if  // Pushes 10
 *   0 (10) (20) if  // Pushes 20
 *
 * Example (new syntax):
 *   1 IF { 10 } ELSE { 20 }  // Pushes 10
 *   0 IF { 10 } ELSE { 20 }  // Pushes 20
 */
export const simpleIfOp: Verb = (vm: VM) => {
  if (vm.SP < 3) {
    throw new Error(
      `Stack underflow: 'if' requires 3 operands (stack: ${JSON.stringify(vm.getStackData())})`
    );
  }

  const elseBranch = vm.pop();
  const thenBranch = vm.pop();
  const condition = vm.pop();

  if (vm.debug) console.log('ifOp', condition, thenBranch, elseBranch);

  // Validate argument types
  if (!isNumber(condition)) {
    throw new Error(`Type error: 'if' condition must be a number, got: ${condition}`);
  }

  // Select the branch to execute based on the condition
  const selectedBranch = condition ? thenBranch : elseBranch;

  // Handle the selected branch based on its type
  if (isCode(selectedBranch)) {
    // If it's code, execute it
    vm.rpush(toTaggedValue(vm.IP, Tag.CODE));
    vm.rpush(vm.BP);
    vm.BP = vm.RP;
    const { value: pointer } = fromTaggedValue(selectedBranch);
    vm.IP = pointer;
  } else {
    // If it's a regular value, just push it back onto the stack
    vm.push(selectedBranch);
  }
};

/**
 * Implements the IF { ... } ELSE { ... } control structure using conditional jumps.
 * 
 * This is the preferred way to write conditionals in Tacit. The syntax is:
 * 
 *   condition IF { then-branch } [ELSE { else-branch }]
 * 
 * Where:
 * - `condition` is any expression that leaves a boolean value on the stack
 * - `then-branch` is executed if condition is true (non-zero)
 * - `else-branch` (optional) is executed if condition is false (zero)
 * 
 * Both branches are code blocks delimited by curly braces { ... } and can contain
 * any number of expressions.
 * 
 * Examples:
 *   // Simple if
 *   1 IF { 10 }  // Pushes 10
 *   0 IF { 10 }  // Does nothing
 *   
 *   // If-else
 *   1 IF { 10 } ELSE { 20 }  // Pushes 10
 *   0 IF { 10 } ELSE { 20 }  // Pushes 20
 *   
 *   // With expressions
 *   5 3 > IF { "greater" } ELSE { "not greater" }  // Pushes "greater"
 *   
 *   // With code blocks
 *   1 IF { 5 2 + } ELSE { 8 3 - }  // Pushes 7
 *   0 IF { 5 2 + } ELSE { 8 3 - }  // Pushes 5
 * 
 * Note: The ELSE block is optional. If omitted and the condition is false,
 *       execution continues with the next instruction.
 * 
 * Stack effect: ( cond -- )
 * 
 * @see simpleIfOp The deprecated version of if-then-else
 */
export const ifCurlyBranchFalseOp: Verb = (vm: VM) => {
  const offset = vm.next16(); // Read the relative offset
  const cond = vm.pop(); // Pop the condition from stack
  console.log(`ifCurlyBranchFalseOp: condition=${cond}, offset=${offset}, jumping=${!isNumber(cond) || cond === 0}`);
  if (!isNumber(cond) || cond === 0) { // Jump if condition is falsy
    vm.IP += offset;
  }
};

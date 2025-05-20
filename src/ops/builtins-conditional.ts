import { VM } from '../core/vm';
import { Verb } from '../core/types';
import { isCode, isNumber, fromTaggedValue, toTaggedValue, CoreTag } from '../core/tagged';

/**
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
    vm.rpush(toTaggedValue(vm.IP, false, CoreTag.CODE));
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
 * Implements conditional jump for curly-brace IF syntax.
 * Pops the condition from the stack and jumps if false.
 */
export const ifCurlyBranchFalseOp: Verb = (vm: VM) => {
  const offset = vm.next16(); // Read the relative offset
  const cond = vm.pop(); // Pop the condition from stack
  console.log(`ifCurlyBranchFalseOp: condition=${cond}, offset=${offset}, jumping=${!isNumber(cond) || cond === 0}`);
  if (!isNumber(cond) || cond === 0) { // Jump if condition is falsy
    vm.IP += offset;
  }
};

import { VM } from '../core/vm';
import { Verb } from '../core/types';
import { isCode, isNumber, fromTaggedValue, toTaggedValue, CoreTag } from '../core/tagged';

/**
 * Implements a ternary if operator
 * Takes three values from the stack:
 * - else-clause (top) - must be a code block
 * - then-clause (middle) - must be a code block
 * - condition (bottom) - must be a number
 *
 * If condition is truthy, the then-clause is executed
 * If condition is falsy, the else-clause is executed
 */
export const ifOp: Verb = (vm: VM) => {
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

  if (!isCode(thenBranch)) {
    throw new Error(`Type error: 'if' then-branch must be code, got: ${thenBranch}`);
  }

  if (!isCode(elseBranch)) {
    throw new Error(`Type error: 'if' else-branch must be code, got: ${elseBranch}`);
  }

  // Select the branch to execute based on the condition
  const selectedBranch = condition ? thenBranch : elseBranch;

  // Evaluate the selected branch
  // This is similar to evalOp in builtins-interpreter.ts
  vm.rpush(toTaggedValue(vm.IP, false, CoreTag.CODE));
  const { value: pointer } = fromTaggedValue(selectedBranch);
  vm.IP = pointer;
};

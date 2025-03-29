import { VM } from '../core/vm';
import { Verb } from '../core/types';
import { isCode, isNumber } from '../core/tagged';

/**
 * Implements a ternary if operator
 * Takes three values from the stack:
 * - condition (top) - must be a number
 * - then-clause (middle) - must be a code block
 * - else-clause (bottom) - must be a code block
 *
 * If condition is truthy, the then-clause is executed/pushed
 * If condition is falsy, the else-clause is executed/pushed
 */
export const ifOp: Verb = (vm: VM) => {
  if (vm.SP < 3) {
    throw new Error(
      `Stack underflow: 'if' requires 3 operands (stack: ${JSON.stringify(vm.getStackData())})`
    );
  }

  const condition = vm.pop();
  const thenBranch = vm.pop();
  const elseBranch = vm.pop();

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

  // If condition is truthy, push the thenBranch, otherwise push the elseBranch
  vm.push(condition ? thenBranch : elseBranch);
};

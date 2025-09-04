/**
 * Implements the repeat combinator: executes a block a specified number of times.
 *
 * Stack effect: ( value count block -- ... )
 * Pops a quotation (block address), count, and value from the stack.
 * Pushes the value back and executes the block count times.
 *
 * @param {VM} vm - The virtual machine instance.
 */
import { VM, Verb, fromTaggedValue } from '@src/core';
import { evalOp } from '../core';

export const repeatOp: Verb = (vm: VM) => {
  vm.ensureStackSize(3, 'repeat');
  const block = vm.pop();
  const countValue = vm.pop();
  const value = vm.pop();

  const { value: count } = fromTaggedValue(countValue);

  if (typeof count !== 'number' || count < 0 || !Number.isInteger(count)) {
    throw new Error('repeat combinator expects a non-negative integer count');
  }

  vm.push(value);

  for (let i = 0; i < count; i++) {
    vm.push(block);
    evalOp(vm);
  }
};

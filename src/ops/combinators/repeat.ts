/**
 * Implements the repeat combinator: executes a block a specified number of times.
 *
 * Stack effect: ( value count block -- ... )
 * Pops a quotation (block address), count, and value from the stack.
 * Pushes the value back and executes the block count times.
 *
 * @param {VM} vm - The virtual machine instance.
 */
import { VM } from '../../core/vm';
import { Verb } from '../../core/types';
import { fromTaggedValue } from '../../core/tagged';

export const repeatOp: Verb = (vm: VM) => {
  vm.ensureStackSize(3, 'repeat');
  const block = vm.pop();
  const countValue = vm.pop();
  const value = vm.pop();
  
  const { value: count } = fromTaggedValue(countValue);
  
  if (typeof count !== 'number' || count < 0 || !Number.isInteger(count)) {
    throw new Error('repeat combinator expects a non-negative integer count');
  }
  
  // Push value back for the block to operate on
  vm.push(value);
  
  // Execute the block count times
  const evalImpl = vm.symbolTable.findImplementationByOpcode(vm.symbolTable.find('eval')!);
  for (let i = 0; i < count; i++) {
    vm.push(block);
    if (evalImpl) {
      evalImpl(vm);
    }
  }
};
/**
 * Implements the do combinator: applies a block to a value.
 *
 * Stack effect: ( x q -- ... )
 * Pops a quotation (block address) and a value, pushes the value, then executes the block.
 *
 * @param {VM} vm - The virtual machine instance.
 */
import { VM } from '../../core/vm';
import { Verb } from '../../core/types';
import { isCode, fromTaggedValue, toTaggedValue, Tag } from '../../core/tagged';
import { exitOp } from '../builtins-interpreter';

export const doOp: Verb = (vm: VM) => {
  vm.ensureStackSize(2, 'do');
  const block = vm.pop();
  const value = vm.pop();
  vm.push(value);
  // Execute the block as a quotation
  if (isCode(block)) {
    vm.rpush(toTaggedValue(vm.IP, Tag.CODE));
    vm.rpush(vm.BP);
    vm.BP = vm.RP;
    const { value: pointer } = fromTaggedValue(block);
    vm.IP = pointer;
    // Immediately exit the block after execution to clean up the return stack
    // This matches the block return model of evalOp and function calls
    exitOp(vm);
  } else {
    throw new Error('do combinator expects a code block');
  }
};

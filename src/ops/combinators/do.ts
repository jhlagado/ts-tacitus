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

export const doOp: Verb = (vm: VM) => {
  vm.ensureStackSize(2, 'do');
  const block = vm.pop();
  const value = vm.pop();
  vm.push(value);

  vm.push(block);
  const evalImpl = vm.symbolTable.findImplementationByOpcode(vm.symbolTable.find('eval')!);
  if (evalImpl) {
    evalImpl(vm);
  }
};

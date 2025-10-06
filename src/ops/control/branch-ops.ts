
import { VM, Verb, isNumber } from '@src/core';

export const ifFalseBranchOp: Verb = (vm: VM) => {
  const offset = vm.nextInt16();
  vm.ensureStackSize(1, 'IF');
  const cond = vm.pop();
  if (!isNumber(cond) || cond === 0) {
    vm.IP += offset;
  }
};

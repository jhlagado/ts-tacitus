import { VM } from '../core/vm';
import { Verb } from '../core/types';
import {} from '../core/memory';

export const dupOp: Verb = (vm: VM) => {
  if (vm.SP < 1) {
    throw new Error(
      `Stack underflow: 'dup' requires 1 operand (stack: ${JSON.stringify(vm.getStackData())})`
    );
  }
  const a = vm.pop();
  if (vm.debug) console.log('dupOp', a);
  vm.push(a);
  vm.push(a);
};

export const dropOp: Verb = (vm: VM) => {
  if (vm.SP < 1) {
    throw new Error(
      `Stack underflow: 'drop' requires 1 operand (stack: ${JSON.stringify(vm.getStackData())})`
    );
  }
  const a = vm.pop();
  if (vm.debug) console.log('dropOp', a);
};

export const swapOp: Verb = (vm: VM) => {
  if (vm.SP < 2) {
    throw new Error(
      `Stack underflow: 'swap' requires 2 operands (stack: ${JSON.stringify(vm.getStackData())})`
    );
  }
  const a = vm.pop();
  const b = vm.pop();
  if (vm.debug) console.log('swapOp', a, b);
  vm.push(a);
  vm.push(b);
};

// New Rot operator: rotates the top three stack items (a b c -> b c a)
export const rotOp: Verb = (vm: VM) => {
  if (vm.SP < 12) {
    throw new Error(
      `Stack underflow: 'rot' requires 3 operands (stack: ${JSON.stringify(vm.getStackData())})`
    );
  }
  const c = vm.pop();
  const b = vm.pop();
  const a = vm.pop();
  if (vm.debug) console.log('rotOp', a, b, c);
  vm.push(b);
  vm.push(c);
  vm.push(a);
};

// New Negative Rot operator (-rot): rotates the top three stack items (a b c -> c a b)
export const negRotOp: Verb = (vm: VM) => {
  if (vm.SP < 12) {
    throw new Error(
      `Stack underflow: '-rot' requires 3 operands (stack: ${JSON.stringify(vm.getStackData())})`
    );
  }
  const c = vm.pop();
  const b = vm.pop();
  const a = vm.pop();
  if (vm.debug) console.log('negRotOp', a, b, c);
  vm.push(c);
  vm.push(a);
  vm.push(b);
};

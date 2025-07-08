import { VM } from '../core/vm';
import { Verb } from '../core/types';
import {} from '../core/memory';
import { fromTaggedValue, Tag } from '../core/tagged';

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
      `Stack underflow: 'drop' requires 1 operand (stack: ${JSON.stringify(vm.getStackData())})`,
    );
  }
  
  // Get the top value without popping it yet
  const topValue = vm.peek();
  const { tag, value } = fromTaggedValue(topValue);
  
  if (tag === Tag.STACK_REF) {
    // This is a tuple reference
    vm.pop(); // Pop the stack reference
    
    // Set the stack pointer to the tuple start position
    if (vm.debug) console.log('dropOp tuple reference, resetting SP to', value);
    vm.SP = value;
  } else {
    // Not a tuple reference, just drop the single value
    vm.pop();
    if (vm.debug) console.log('dropOp single value');
  }
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

import { VM } from '../core/vm';
import { Verb } from '../core/types';
import {} from '../core/memory';
import { fromTaggedValue, toTaggedValue, Tag } from '../core/tagged';

export const dupOp: Verb = (vm: VM) => {
  if (vm.SP < 1) {
    throw new Error(
      `Stack underflow: 'dup' requires 1 operand (stack: ${JSON.stringify(vm.getStackData())})`
    );
  }
  
  // Peek at the top value without removing it yet
  const topValue = vm.peek();
  const { tag, value } = fromTaggedValue(topValue);
  
  if (tag === Tag.LINK) {
    // This is a tuple link
    vm.pop(); // Pop the link
    
    if (vm.debug) console.log('dupOp tuple link with relative count:', value);
    
    // Calculate how many elements to copy (including the tuple tag)
    const elementsToCopy = value;
    const startSP = vm.SP - (elementsToCopy * 4);
    
    // Copy each element from the tuple (from start to current SP)
    const tupleCopy = [];
    for (let pos = startSP; pos < vm.SP; pos += 4) {
      const element = vm.memory.readFloat32(0, pos);
      tupleCopy.push(element);
    }
    
    // Push all copied elements onto the stack
    for (const element of tupleCopy) {
      vm.push(element);
    }
    
    // Push the link to the duplicated tuple
    // The value remains the same as the original link (same element count)
    vm.push(toTaggedValue(value, Tag.LINK));
  } else {
    // Regular value, just duplicate it
    const a = vm.pop();
    if (vm.debug) console.log('dupOp simple value', a);
    vm.push(a);
    vm.push(a);
  }
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
  
  if (tag === Tag.LINK) {
    // This is a tuple link with relative element count
    vm.pop(); // Pop the link
    
    // Calculate the absolute stack position by going backwards from current SP
    // Each element is 4 bytes, so multiply by 4 to get byte offset
    const targetSP = vm.SP - (value * 4);
    
    // Set the stack pointer to the tuple start position
    if (vm.debug) console.log('dropOp tuple link, resetting SP to', targetSP, 'from relative elements:', value);
    vm.SP = targetSP;
  } else {
    // Not a tuple link, just drop the single value
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

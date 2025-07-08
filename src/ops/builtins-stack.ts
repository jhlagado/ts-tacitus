import { VM } from '../core/vm';
import { Verb } from '../core/types';
import { Tag, fromTaggedValue } from '../core/tagged';
import { SEG_STACK } from '../core/memory';

export const dupOp: Verb = (vm: VM) => {
  if (vm.SP < 4) { // Need at least 4 bytes (one float)
    throw new Error(
      `Stack underflow: 'dup' requires 1 operand (stack: ${JSON.stringify(vm.getStackData())})`
    );
  }
  
  // Get the top value without popping it
  const topValue = vm.peek();
  const { tag, value } = fromTaggedValue(topValue);
  
  if (tag === Tag.LINK) {
    // This is a tuple reference
    // Value is how many stack slots to go back to find the TUPLE tag
    const elemCount = value + 1; // +1 to include the LINK tag itself
    
    // Each element is 4 bytes (float32)
    const byteOffset = elemCount * 4;
    
    // Starting position in the stack (measured in bytes)
    const startByte = vm.SP - byteOffset;
    
    // Copy each element from the tuple and push it to the stack
    for (let i = 0; i < elemCount; i++) {
      // Read a float32 value from stack memory
      const val = vm.memory.readFloat32(SEG_STACK, startByte + (i * 4));
      vm.push(val);
    }
  } else {
    // Regular value, just duplicate it
    vm.push(topValue);
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

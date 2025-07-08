import { VM } from '../core/vm';
import { Verb } from '../core/types';
import { Tag, fromTaggedValue, toTaggedValue } from '../core/tagged';

export const dupOp: Verb = (vm: VM) => {
  if (vm.SP < 1) {
    throw new Error(
      `Stack underflow: 'dup' requires 1 operand (stack: ${JSON.stringify(vm.getStackData())})`
    );
  }
  
  // Get the top value without popping it
  const topValue = vm.peek();
  const { tag, value } = fromTaggedValue(topValue);
  
  if (tag === Tag.LINK) {
    // This is a tuple reference
    if (vm.debug) console.log('dupOp tuple link with value:', value);
    
    // Get the current stack state
    const stack = vm.getStackData();
    const stackLen = stack.length;
    
    if (value <= 0 || value >= stackLen) {
      throw new Error(`Invalid LINK value: ${value} (stack length: ${stackLen})`);
    }
    
    // Calculate the tuple start index in the stack array
    // Stack array is 0-indexed, and we need to go back 'value' elements from the end
    const tupleStartIndex = stackLen - 1 - value;
    
    // Read the tuple tag from stack array to get the tuple size
    const tupleTagValue = stack[tupleStartIndex];
    const { tag: tupleTag, value: tupleSize } = fromTaggedValue(tupleTagValue);
    
    // Verify we found a valid tuple tag
    if (tupleTag !== Tag.TUPLE) {
      throw new Error(`Expected TUPLE tag at stack index ${tupleStartIndex}, found tag ${tupleTag}`);
    }
    
    // Step 1: Push a new copy of the tuple tag
    vm.push(tupleTagValue);
    
    // Step 2: Push copies of all the tuple elements (from tuple values array)
    for (let i = 0; i < tupleSize; i++) {
      const elemIndex = tupleStartIndex + i + 1; // +1 to skip the TUPLE tag
      vm.push(stack[elemIndex]);
    }
    
    // Step 3: Push a new LINK tag with the correct value
    // The LINK value should be tupleSize + 1 (count of elements back to the tuple tag)
    vm.push(toTaggedValue(tupleSize + 1, Tag.LINK));
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

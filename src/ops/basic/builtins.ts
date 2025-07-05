/**
 * @file src/ops/basic/builtins.ts
 * Defines the basic operations for the simplified Forth-like Tacit language
 */

import { VM } from '../../core/vm';
import { toTaggedValue, fromTaggedValue, CoreTag, isNIL } from '../../core/tagged';

// Type for operation functions
export type Operation = (vm: VM) => void;

// Operations dictionary
export interface OperationMap {
  [key: string]: Operation;
}

/**
 * Stack Operations
 */
export const dupOp: Operation = (vm: VM) => {
  const a = vm.pop();
  vm.push(a);
  vm.push(a);
};

export const dropOp: Operation = (vm: VM) => {
  vm.pop();
};

export const swapOp: Operation = (vm: VM) => {
  const a = vm.pop();
  const b = vm.pop();
  vm.push(a);
  vm.push(b);
};

export const overOp: Operation = (vm: VM) => {
  const a = vm.pop();
  const b = vm.pop();
  vm.push(b);
  vm.push(a);
  vm.push(b);
};

export const rotOp: Operation = (vm: VM) => {
  const a = vm.pop();
  const b = vm.pop();
  const c = vm.pop();
  vm.push(b);
  vm.push(a);
  vm.push(c);
};

/**
 * Arithmetic Operations
 */
export const addOp: Operation = (vm: VM) => {
  const b = vm.pop();
  const a = vm.pop();
  const { value: valB, tag: tagB } = fromTaggedValue(b);
  const { value: valA, tag: tagA } = fromTaggedValue(a);
  
  // Handle different type combinations
  if (tagA === CoreTag.NUMBER || tagB === CoreTag.NUMBER) {
    // If either is a NUMBER, result is a NUMBER
    const numA = tagA === CoreTag.NUMBER ? a : valA;
    const numB = tagB === CoreTag.NUMBER ? b : valB;
    vm.push(numA + numB);
  } else {
    // Both are INTEGERs
    const result = valA + valB;
    // Check if result fits in 16-bit integer range
    if (result >= -32768 && result <= 32767) {
      vm.push(toTaggedValue(result, false, CoreTag.INTEGER));
    } else {
      // Overflow, convert to number
      vm.push(result);
    }
  }
};

export const subOp: Operation = (vm: VM) => {
  const b = vm.pop();
  const a = vm.pop();
  const { value: valB, tag: tagB } = fromTaggedValue(b);
  const { value: valA, tag: tagA } = fromTaggedValue(a);
  
  if (tagA === CoreTag.NUMBER || tagB === CoreTag.NUMBER) {
    const numA = tagA === CoreTag.NUMBER ? a : valA;
    const numB = tagB === CoreTag.NUMBER ? b : valB;
    vm.push(numA - numB);
  } else {
    const result = valA - valB;
    if (result >= -32768 && result <= 32767) {
      vm.push(toTaggedValue(result, false, CoreTag.INTEGER));
    } else {
      vm.push(result);
    }
  }
};

export const mulOp: Operation = (vm: VM) => {
  const b = vm.pop();
  const a = vm.pop();
  const { value: valB, tag: tagB } = fromTaggedValue(b);
  const { value: valA, tag: tagA } = fromTaggedValue(a);
  
  if (tagA === CoreTag.NUMBER || tagB === CoreTag.NUMBER) {
    const numA = tagA === CoreTag.NUMBER ? a : valA;
    const numB = tagB === CoreTag.NUMBER ? b : valB;
    vm.push(numA * numB);
  } else {
    const result = valA * valB;
    if (result >= -32768 && result <= 32767) {
      vm.push(toTaggedValue(result, false, CoreTag.INTEGER));
    } else {
      vm.push(result);
    }
  }
};

export const divOp: Operation = (vm: VM) => {
  const b = vm.pop();
  const a = vm.pop();
  const { value: valB, tag: tagB } = fromTaggedValue(b);
  const { value: valA, tag: tagA } = fromTaggedValue(a);
  
  if (tagB === CoreTag.INTEGER && valB === 0) {
    throw new Error("Division by zero");
  }
  
  const numA = tagA === CoreTag.NUMBER ? a : valA;
  const numB = tagB === CoreTag.NUMBER ? b : valB;
  vm.push(numA / numB);
};

export const modOp: Operation = (vm: VM) => {
  const b = vm.pop();
  const a = vm.pop();
  const { value: valB, tag: tagB } = fromTaggedValue(b);
  const { value: valA, tag: tagA } = fromTaggedValue(a);
  
  if (tagA === CoreTag.INTEGER && tagB === CoreTag.INTEGER) {
    if (valB === 0) {
      throw new Error("Modulo by zero");
    }
    const result = valA % valB;
    vm.push(toTaggedValue(result, false, CoreTag.INTEGER));
  } else {
    const numA = tagA === CoreTag.NUMBER ? a : valA;
    const numB = tagB === CoreTag.NUMBER ? b : valB;
    if (numB === 0) {
      throw new Error("Modulo by zero");
    }
    vm.push(numA % numB);
  }
};

/**
 * Comparison Operations
 */
export const eqOp: Operation = (vm: VM) => {
  const b = vm.pop();
  const a = vm.pop();
  const { value: valB, tag: tagB } = fromTaggedValue(b);
  const { value: valA, tag: tagA } = fromTaggedValue(a);
  
  let result: boolean;
  if (tagA === tagB) {
    if (tagA === CoreTag.NUMBER) {
      result = a === b;
    } else {
      result = valA === valB;
    }
  } else if (tagA === CoreTag.NUMBER || tagB === CoreTag.NUMBER) {
    const numA = tagA === CoreTag.NUMBER ? a : valA;
    const numB = tagB === CoreTag.NUMBER ? b : valB;
    result = numA === numB;
  } else {
    result = false; // Different tags, not equal
  }
  
  vm.push(toTaggedValue(result ? -1 : 0, false, CoreTag.INTEGER));
};

export const ltOp: Operation = (vm: VM) => {
  const b = vm.pop();
  const a = vm.pop();
  const { value: valB, tag: tagB } = fromTaggedValue(b);
  const { value: valA, tag: tagA } = fromTaggedValue(a);
  
  let result: boolean;
  if (tagA === CoreTag.NUMBER || tagB === CoreTag.NUMBER) {
    const numA = tagA === CoreTag.NUMBER ? a : valA;
    const numB = tagB === CoreTag.NUMBER ? b : valB;
    result = numA < numB;
  } else {
    result = valA < valB;
  }
  
  vm.push(toTaggedValue(result ? -1 : 0, false, CoreTag.INTEGER));
};

export const gtOp: Operation = (vm: VM) => {
  const b = vm.pop();
  const a = vm.pop();
  const { value: valB, tag: tagB } = fromTaggedValue(b);
  const { value: valA, tag: tagA } = fromTaggedValue(a);
  
  let result: boolean;
  if (tagA === CoreTag.NUMBER || tagB === CoreTag.NUMBER) {
    const numA = tagA === CoreTag.NUMBER ? a : valA;
    const numB = tagB === CoreTag.NUMBER ? b : valB;
    result = numA > numB;
  } else {
    result = valA > valB;
  }
  
  vm.push(toTaggedValue(result ? -1 : 0, false, CoreTag.INTEGER));
};

/**
 * Control Flow Operations
 */
export const ifOp: Operation = (vm: VM) => {
  const falseAddr = vm.pop();
  const trueAddr = vm.pop();
  const condition = vm.pop();
  
  if (isNIL(condition)) {
    // Condition is false (0 or NIL)
    const { value: addr } = fromTaggedValue(falseAddr);
    vm.IP = addr;
  } else {
    // Condition is true (non-zero)
    const { value: addr } = fromTaggedValue(trueAddr);
    vm.IP = addr;
  }
};

/**
 * Register all basic operations
 */
export function registerBasicOps(): OperationMap {
  const ops: OperationMap = {
    // Stack operations
    'dup': dupOp,
    'drop': dropOp,
    'swap': swapOp,
    'over': overOp,
    'rot': rotOp,
    
    // Arithmetic operations
    '+': addOp,
    '-': subOp,
    '*': mulOp,
    '/': divOp,
    'mod': modOp,
    
    // Comparison operations
    '=': eqOp,
    '<': ltOp,
    '>': gtOp,
    
    // Control flow
    'if': ifOp,
  };
  
  return ops;
}

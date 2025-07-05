/**
 * @file src/ops/basic/builtins.ts
 * Defines the basic operations for the simplified Forth-like Tacit language
 */

import { VM } from '../../core/vm';
import { fromTaggedValue, isNIL } from '../../core/tagged';

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
  // Preserve the exact bit pattern of tagged values
  vm.push(a);
  vm.push(a);
};

export const dropOp: Operation = (vm: VM) => {
  vm.pop();
};

export const swapOp: Operation = (vm: VM) => {
  const a = vm.pop(); // top
  const b = vm.pop(); // second
  vm.push(a); // push top first
  vm.push(b); // then second
};

export const overOp: Operation = (vm: VM) => {
  const a = vm.pop(); // top
  const b = vm.pop(); // second
  vm.push(b); // push second
  vm.push(a); // push top
  vm.push(b); // push second again (duplicate second to top)
};

export const rotOp: Operation = (vm: VM) => {
  const a = vm.pop(); // top (3rd)
  const b = vm.pop(); // 2nd
  const c = vm.pop(); // 1st
  // Rotate: 1 2 3 -> 2 3 1
  vm.push(b); // push 2nd
  vm.push(a); // push top (3rd)
  vm.push(c); // push 1st
};

/**
 * Arithmetic Operations
 */
export const addOp: Operation = (vm: VM) => {
  const b = vm.pop();
  const a = vm.pop();

  // Check if values are NaN (tagged values)
  if (isNaN(a) || isNaN(b)) {
    throw new Error('Arithmetic operations only work with float values');
  }

  // Simple float addition
  vm.push(a + b);
};

export const subOp: Operation = (vm: VM) => {
  const b = vm.pop();
  const a = vm.pop();

  // Check if values are NaN (tagged values)
  if (isNaN(a) || isNaN(b)) {
    throw new Error('Arithmetic operations only work with float values');
  }

  // Simple float subtraction
  vm.push(a - b);
};

export const mulOp: Operation = (vm: VM) => {
  const b = vm.pop();
  const a = vm.pop();

  // Check if values are NaN (tagged values)
  if (isNaN(a) || isNaN(b)) {
    throw new Error('Arithmetic operations only work with float values');
  }

  // Simple float multiplication
  vm.push(a * b);
};

export const divOp: Operation = (vm: VM) => {
  const b = vm.pop();
  const a = vm.pop();

  // Check if values are NaN (tagged values)
  if (isNaN(a) || isNaN(b)) {
    throw new Error('Arithmetic operations only work with float values');
  }

  // Check for division by zero
  if (b === 0) {
    throw new Error('Division by zero');
  }

  // Simple float division
  vm.push(a / b);
};

export const modOp: Operation = (vm: VM) => {
  const b = vm.pop();
  const a = vm.pop();

  // Check if values are NaN (tagged values)
  if (isNaN(a) || isNaN(b)) {
    throw new Error('Arithmetic operations only work with float values');
  }

  // Check for modulo by zero
  if (b === 0) {
    throw new Error('Modulo by zero');
  }

  // Simple float modulo - no unwrapping tags
  vm.push(a % b);
};

/**
 * Comparison Operations
 */
export const eqOp: Operation = (vm: VM) => {
  const b = vm.pop();
  const a = vm.pop();

  // For equality we don't reject NaN values, as comparing two identical NaN-tagged values is valid
  // But we do direct bit comparison, not semantic comparison

  // Simple direct equality check
  const result = a === b;
  vm.push(result ? 1 : 0);
};

export const ltOp: Operation = (vm: VM) => {
  const b = vm.pop();
  const a = vm.pop();

  // Check if values are NaN (tagged values)
  if (isNaN(a) || isNaN(b)) {
    throw new Error('Comparison operations only work with float values');
  }

  // Simple float comparison
  const result = a < b;
  vm.push(result ? 1 : 0);
};

export const gtOp: Operation = (vm: VM) => {
  const b = vm.pop();
  const a = vm.pop();

  // Check if values are NaN (tagged values)
  if (isNaN(a) || isNaN(b)) {
    throw new Error('Comparison operations only work with float values');
  }

  // Simple float comparison
  const result = a > b;
  vm.push(result ? 1 : 0);
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
    dup: dupOp,
    drop: dropOp,
    swap: swapOp,
    over: overOp,
    rot: rotOp,

    // Arithmetic operations
    '+': addOp,
    '-': subOp,
    '*': mulOp,
    '/': divOp,
    mod: modOp,

    // Comparison operations
    '=': eqOp,
    '<': ltOp,
    '>': gtOp,

    // Control flow
    if: ifOp,
  };

  return ops;
}

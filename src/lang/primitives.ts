/**
 * @file src/lang/primitives.ts
 * Basic primitive operations for the Tacit language
 */

import { VM } from '../core/vm';
import { SymbolTable } from '../strings/symbol-table';
import { fromTaggedValue } from '../core/tagged';

/**
 * Helper function to get a raw number value from a potentially tagged value
 */
function getRawNumber(value: number): number {
  if (isNaN(value)) {
    const { value: rawValue } = fromTaggedValue(value);
    return rawValue;
  }
  return value;
}

/**
 * Initialize primitive operations in the symbol table
 */
export function initializePrimitives(symbolTable: SymbolTable): void {
  // Arithmetic operations
  symbolTable.define('+', (vm: VM) => {
    const b = getRawNumber(vm.pop());
    const a = getRawNumber(vm.pop());
    vm.push(a + b);
  });

  symbolTable.define('-', (vm: VM) => {
    const b = getRawNumber(vm.pop());
    const a = getRawNumber(vm.pop());
    vm.push(a - b);
  });

  symbolTable.define('*', (vm: VM) => {
    const b = getRawNumber(vm.pop());
    const a = getRawNumber(vm.pop());
    vm.push(a * b);
  });

  symbolTable.define('/', (vm: VM) => {
    const b = getRawNumber(vm.pop());
    const a = getRawNumber(vm.pop());
    if (b === 0) {
      throw new Error('Division by zero');
    }
    vm.push(a / b);
  });

  // Stack manipulation
  symbolTable.define('dup', (vm: VM) => {
    const value = vm.pop();
    vm.push(value);
    vm.push(value);
  });

  symbolTable.define('drop', (vm: VM) => {
    vm.pop();
  });

  symbolTable.define('swap', (vm: VM) => {
    const b = vm.pop();
    const a = vm.pop();
    vm.push(b);
    vm.push(a);
  });

  symbolTable.define('over', (vm: VM) => {
    const b = vm.pop();
    const a = vm.pop();
    vm.push(a);
    vm.push(b);
    vm.push(a);
  });

  symbolTable.define('rot', (vm: VM) => {
    const c = vm.pop();
    const b = vm.pop();
    const a = vm.pop();
    vm.push(b);
    vm.push(c);
    vm.push(a);
  });
}

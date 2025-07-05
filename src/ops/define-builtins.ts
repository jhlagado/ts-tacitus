import { SymbolTable } from '../strings/symbol-table';
import { VM } from '../core/vm';
import { registerBasicOps, OperationMap } from './basic/builtins';

/**
 * Defines the built-in functions in the given symbol table.
 * This function maps symbolic names (strings) to their corresponding operations,
 * allowing the Tacit interpreter to recognize and execute these functions.
 * @param {SymbolTable} dict The symbol table to populate with built-in functions.
 */
export const defineBuiltins = (dict: SymbolTable) => {
  // Register basic operations
  const ops: OperationMap = registerBasicOps();
  
  // Define each operation in the symbol table
  for (const [name, operation] of Object.entries(ops)) {
    // Execute the operation directly
    dict.define(name, operation);
  }
  
  // Add print operation
  dict.define('.', (vm: VM) => {
    // Pop and display a value
    const value = vm.pop();
    console.log(value);
  });
  
  // Add eval operation
  dict.define('eval', (vm: VM) => {
    vm.eval();
  });
};

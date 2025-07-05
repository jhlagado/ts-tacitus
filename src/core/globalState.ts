/**
 * @file src/core/globalState.ts
 * Global state for the minimal Tacit language implementation
 */

import { VM } from './vm';
import { defineBuiltins } from '../ops/define-builtins';

// Global VM instance
export let vm = new VM();

// Function to reset the interpreter state
export function initializeInterpreter() {
  vm = new VM();
  // Initialize operations in the symbol table
  defineBuiltins(vm.symbolTable);
}

// Initialize operations on first load
defineBuiltins(vm.symbolTable);

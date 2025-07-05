/**
 * @file src/core/globalState.ts
 * Global state for the minimal Tacit language implementation
 */

import { VM } from './vm';
import { initializePrimitives } from '../lang/primitives';

// Global VM instance
export let vm = new VM();

// Function to reset the interpreter state
export function initializeInterpreter() {
  vm = new VM();
  // Initialize primitive operations in the symbol table
  initializePrimitives(vm.symbolTable);
}

// Initialize primitives on first load
initializePrimitives(vm.symbolTable);

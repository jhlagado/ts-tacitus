import { VM } from './vm';
import { Compiler } from '../lang/compiler';

/**
 * Global VM instance
 */
export let vm: VM;

/**
 * Initializes the interpreter with proper dependency handling to avoid circular references.
 * This approach ensures that VM and Compiler are properly connected without creating
 * circular dependencies at import time.
 */
export function initializeInterpreter(): void {
  // Step 1: Create VM instance without Compiler
  vm = new VM();
  
  // Step 2: Create Compiler with reference to VM
  const compiler = new Compiler(vm);
  
  // Step 3: Complete VM initialization with Compiler
  vm.initializeCompilerAndFunctionTable(compiler);
}

// Initialize the global VM instance immediately
initializeInterpreter();

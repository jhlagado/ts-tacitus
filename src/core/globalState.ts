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
  vm = new VM();

  const compiler = new Compiler(vm);

  vm.initializeCompilerAndFunctionTable(compiler);
}

initializeInterpreter();

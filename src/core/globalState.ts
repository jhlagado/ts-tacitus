/**
 * @file src/core/globalState.ts
 * 
 * This file manages the global state of the Tacit VM, providing a singleton VM instance
 * that can be accessed throughout the codebase. It handles the initialization of the VM
 * and its dependencies, particularly addressing circular dependency issues between
 * the VM and Compiler classes.
 * 
 * The global state pattern is used here to provide a consistent entry point for
 * accessing the VM instance from various parts of the codebase, especially from
 * operation implementations that need to interact with the VM.
 */

import { VM } from './vm';
import { Compiler } from '../lang/compiler';

/**
 * Global VM instance
 * 
 * This is the singleton VM instance used throughout the Tacit implementation.
 * It is initialized by the initializeInterpreter function and provides access
 * to the VM's state and operations from any module that imports it.
 */
export let vm: VM;

/**
 * Initializes the interpreter with proper dependency handling to avoid circular references.
 * 
 * This function creates and configures the global VM instance and its dependencies.
 * It specifically addresses the circular dependency between VM and Compiler by:
 * 1. Creating a new VM instance
 * 2. Creating a new Compiler instance that references the VM
 * 3. Initializing the VM with the Compiler instance
 * 
 * This approach ensures that VM and Compiler are properly connected without creating
 * circular dependencies at import time.
 */
export function initializeInterpreter(): void {
  vm = new VM();
  const compiler = new Compiler(vm);
  vm.initializeCompiler(compiler);
}

initializeInterpreter();

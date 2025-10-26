/**
 * @file src/lang/runtime.ts
 *
 * Runtime wiring for the Tacit VM: provides a singleton VM instance and
 * an explicit setup function to initialize the interpreter without creating
 * Core → Lang coupling or import-time side effects.
 */

import { VM } from '@src/core';
import { Compiler } from './compiler';
import { registerBuiltins } from '../ops/builtins-register';

/**
 * Global VM instance used by the interpreter.
 * Initialized by calling {@link setupRuntime}.
 */
export let vm: VM;

/**
 * Initializes the interpreter runtime.
 *
 * Creates a VM, wires a Compiler to it, and registers builtins. This function is
 * intentionally side-effect free at import time — it must be called by entrypoints
 * (CLI, REPL, file processor) before executing any Tacit code.
 */
export function setupRuntime(): void {
  vm = new VM();
  const compiler = new Compiler(vm);
  vm.compiler = compiler;
  // Register built-in operations at composition time
  registerBuiltins(vm, vm.symbolTable);
}

// Backward-compatible alias for legacy imports/tests
export { setupRuntime as initializeInterpreter };

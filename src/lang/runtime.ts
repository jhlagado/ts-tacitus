/**
 * @file src/lang/runtime.ts
 *
 * Runtime wiring for the Tacit VM: provides a singleton VM instance and
 * an explicit setup function to initialize the interpreter without creating
 * Core → Lang coupling or import-time side effects.
 */

import { createVM, type VM } from '../core/vm';

/**
 * Global VM instance used by the interpreter.
 * Initialized by calling {@link setupRuntime}.
 */
let vm: VM;

/**
 * Initializes the interpreter runtime.
 *
 * Creates a VM, wires a Compiler to it, and registers builtins. This function is
 * intentionally side-effect free at import time — it must be called by entrypoints
 * (CLI, REPL, file processor) before executing any Tacit code.
 *
 * @returns The initialized VM instance
 */
export function setupRuntime(): VM {
  vm = createVM();
  return vm;
}

/**
 * Gets the current runtime VM instance (for legacy code that still needs it).
 * Prefer passing VM explicitly instead of using this.
 *
 * @deprecated Use explicit VM passing instead
 */
export function getRuntimeVM(): VM {
  if (!vm) {
    throw new Error('Runtime VM not initialized. Call setupRuntime() first.');
  }
  return vm;
}

// Backward-compatible alias for legacy imports/tests
export { setupRuntime as initializeInterpreter };

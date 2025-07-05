/**
 * @file src/core/simplified-global-state.ts
 * Global state for the simplified Tacit language implementation
 */

import { VM } from './vm';

// Global VM instance
export let vm = new VM();

// Function to reset the interpreter state
export function initializeInterpreter() {
  vm = new VM();
}

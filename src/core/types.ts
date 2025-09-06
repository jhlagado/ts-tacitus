/**
 * @file src/core/types.ts
 *
 * This file defines core type definitions used throughout the Tacit VM implementation.
 * It provides type aliases for common function signatures and interfaces used by
 * the VM's operation system.
 */

import { VM } from './vm';

/**
 * A function that operates on the VM.
 *
 * This type represents the signature for all operations (verbs) in the Tacit VM.
 * Each verb takes a VM instance as its only parameter and returns void. Operations
 * interact with the VM by manipulating its stacks, memory, and other state variables.
 *
 * Verbs are the fundamental building blocks of the Tacit language, implementing
 * both built-in operations and user-defined words.
 */
export type Verb = (vm: VM) => void;

/**
 * @file src/ops/dispatch-table.ts
 * Direct dispatch table for C-port preparation.
 * Replaces complex registration system with simple array lookup.
 */

import { VM } from '../core/vm';
import { Op } from './opcodes';

// Built-in operation function type (C-ready)
export type BuiltinOpFn = (vm: VM) => void;

// Maximum builtin opcodes (matches C #define MAX_BUILTIN_OPCODE)
const MAX_BUILTIN_OPCODES = 128;

/**
 * Direct dispatch table for built-in operations
 * Maps to C: vm_op_fn dispatch_table[MAX_BUILTIN_OPCODES];
 */
export const DISPATCH_TABLE: (BuiltinOpFn | null)[] = new Array(MAX_BUILTIN_OPCODES).fill(null);

/**
 * Register a built-in operation in dispatch table
 * Direct mapping to C: dispatch_table[opcode] = function_ptr;
 * 
 * @param opcode Operation code (0-127)
 * @param fn Operation function
 */
export function registerBuiltinOp(opcode: Op, fn: BuiltinOpFn): void {
  if (opcode < 0 || opcode >= MAX_BUILTIN_OPCODES) {
    throw new Error(`Invalid opcode: ${opcode}`);
  }
  DISPATCH_TABLE[opcode] = fn;
}

/**
 * Execute built-in operation via direct dispatch
 * Direct mapping to C: if (dispatch_table[opcode]) dispatch_table[opcode](vm);
 * 
 * @param vm VM instance
 * @param opcode Operation code
 * @returns true if operation was found and executed
 */
export function executeBuiltinOp(vm: VM, opcode: Op): boolean {
  const fn = DISPATCH_TABLE[opcode];
  if (fn === null) {
    return false;
  }
  
  fn(vm);
  return true;
}
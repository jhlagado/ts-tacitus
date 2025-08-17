/**
 * @file src/core/code-ref.ts
 *
 * This file provides utility functions for creating and manipulating code references
 * in the Tacit VM. These utilities support the unified @symbol system by providing
 * clean APIs for creating both built-in and bytecode references that work with
 * the enhanced evalOp function.
 *
 * The utilities bridge the gap between raw opcodes/addresses and tagged values,
 * making it easier to work with code references throughout the VM system.
 */

import { Tag, toTaggedValue } from './tagged';
import { MAX_BUILTIN_OPCODE } from './constants';

/**
 * Creates a tagged reference to a built-in operation.
 *
 * This function takes a built-in opcode and wraps it in a Tag.BUILTIN tagged value
 * that can be executed by evalOp. This is used to create executable references
 * to built-in operations like add, dup, multiply, etc.
 *
 * @param opcode - The opcode of the built-in operation (0-127)
 * @returns A Tag.BUILTIN tagged value that can be executed by evalOp
 * @throws {Error} If the opcode is out of valid range
 *
 * @example
 * ```typescript
 * // Create a reference to the add operation
 * const addRef = createBuiltinRef(Op.Add);
 * vm.push(2);
 * vm.push(3);
 * vm.push(addRef);
 * evalOp(vm); // Executes add operation, result: 5
 * ```
 */
export function createBuiltinRef(opcode: number): number {
  if (opcode < 0 || opcode > MAX_BUILTIN_OPCODE) {
    throw new Error(`Invalid builtin opcode: ${opcode}. Must be in range 0-${MAX_BUILTIN_OPCODE}.`);
  }
  return toTaggedValue(opcode, Tag.BUILTIN);
}

/**
 * Creates a tagged reference to bytecode at a specific address.
 *
 * This function takes a bytecode address and wraps it in a Tag.CODE tagged value
 * that can be executed by evalOp. This is used to create executable references
 * to user-defined functions and code blocks.
 *
 * @param bytecodeAddr - The address of the bytecode in the code segment
 * @returns A Tag.CODE tagged value that can be executed by evalOp
 * @throws {Error} If the address is out of valid range
 *
 * @example
 * ```typescript
 * // Create a reference to bytecode at address 1000
 * const codeRef = createCodeRef(1000);
 * vm.push(codeRef);
 * evalOp(vm); // Executes bytecode at address 1000
 * ```
 */
export function createCodeRef(bytecodeAddr: number): number {
  if (bytecodeAddr < 0 || bytecodeAddr > 65535) {
    throw new Error(`Invalid bytecode address: ${bytecodeAddr}. Must be in range 0-65535.`);
  }
  return toTaggedValue(bytecodeAddr, Tag.CODE);
}






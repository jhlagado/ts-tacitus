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

import { toTaggedValue, fromTaggedValue, Tag } from './tagged';

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
  if (opcode < 0 || opcode > 127) {
    throw new Error(`Invalid builtin opcode: ${opcode}. Must be in range 0-127.`);
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

/**
 * Checks if a tagged value represents a built-in operation reference.
 *
 * This function determines whether a tagged value is a reference to a built-in
 * operation that can be executed directly by the VM.
 *
 * @param value - The tagged value to check
 * @returns True if the value is a Tag.BUILTIN reference, false otherwise
 *
 * @example
 * ```typescript
 * const addRef = createBuiltinRef(Op.Add);
 * const codeRef = createCodeRef(1000);
 *
 * console.log(isBuiltinRef(addRef));  // true
 * console.log(isBuiltinRef(codeRef)); // false
 * console.log(isBuiltinRef(42));      // false
 * ```
 */
export function isBuiltinRef(value: number): boolean {
  try {
    const { tag } = fromTaggedValue(value);
    return tag === Tag.BUILTIN;
  } catch {
    return false;
  }
}

/**
 * Checks if a tagged value represents a bytecode reference.
 *
 * This function determines whether a tagged value is a reference to bytecode
 * that can be executed by setting up a call frame and jumping to the address.
 *
 * @param value - The tagged value to check
 * @returns True if the value is a Tag.CODE reference, false otherwise
 *
 * @example
 * ```typescript
 * const addRef = createBuiltinRef(Op.Add);
 * const codeRef = createCodeRef(1000);
 *
 * console.log(isCodeRef(addRef));  // false
 * console.log(isCodeRef(codeRef)); // true
 * console.log(isCodeRef(42));      // false
 * ```
 */
export function isCodeRef(value: number): boolean {
  try {
    const { tag } = fromTaggedValue(value);
    return tag === Tag.CODE || tag === Tag.CODE_BLOCK;
  } catch {
    return false;
  }
}

/**
 * Checks if a tagged value represents any kind of executable code reference.
 *
 * This function determines whether a tagged value can be executed by evalOp,
 * regardless of whether it's a built-in operation or bytecode.
 *
 * @param value - The tagged value to check
 * @returns True if the value is executable (Tag.BUILTIN, Tag.CODE, or Tag.CODE_BLOCK)
 *
 * @example
 * ```typescript
 * const addRef = createBuiltinRef(Op.Add);
 * const codeRef = createCodeRef(1000);
 *
 * console.log(isExecutableRef(addRef));  // true
 * console.log(isExecutableRef(codeRef)); // true
 * console.log(isExecutableRef(42));      // false
 * ```
 */
export function isExecutableRef(value: number): boolean {
  return isBuiltinRef(value) || isCodeRef(value);
}

/**
 * Extracts the opcode from a built-in reference.
 *
 * This function safely extracts the opcode from a Tag.BUILTIN tagged value.
 * It should only be called on values that have been verified as built-in references.
 *
 * @param builtinRef - A Tag.BUILTIN tagged value
 * @returns The opcode of the built-in operation
 * @throws {Error} If the value is not a valid built-in reference
 *
 * @example
 * ```typescript
 * const addRef = createBuiltinRef(Op.Add);
 * const opcode = getBuiltinOpcode(addRef);
 * console.log(opcode === Op.Add); // true
 * ```
 */
export function getBuiltinOpcode(builtinRef: number): number {
  if (!isBuiltinRef(builtinRef)) {
    throw new Error('Value is not a built-in reference');
  }
  const { value } = fromTaggedValue(builtinRef);
  return value;
}

/**
 * Extracts the bytecode address from a code reference.
 *
 * This function safely extracts the address from a Tag.CODE or Tag.CODE_BLOCK
 * tagged value. It should only be called on values that have been verified as code references.
 *
 * @param codeRef - A Tag.CODE or Tag.CODE_BLOCK tagged value
 * @returns The bytecode address
 * @throws {Error} If the value is not a valid code reference
 *
 * @example
 * ```typescript
 * const codeRef = createCodeRef(1000);
 * const addr = getCodeAddress(codeRef);
 * console.log(addr === 1000); // true
 * ```
 */
export function getCodeAddress(codeRef: number): number {
  if (!isCodeRef(codeRef)) {
    throw new Error('Value is not a code reference');
  }
  const { value } = fromTaggedValue(codeRef);
  return value;
}

/**
 * @file src/core/errors.ts
 * 
 * This file implements structured error classes for the Tacit VM.
 * These error classes provide more context for debugging and error recovery,
 * including information about the VM state at the time of the error.
 */

/**
 * Base error class for all VM-related errors.
 * Includes information about the stack state at the time of the error.
 */
export class VMError extends Error {
  /**
   * Creates a new VMError instance.
   * 
   * @param {string} message - The error message
   * @param {number[]} stackState - The state of the data stack at the time of the error
   */
  constructor(message: string, public readonly stackState: number[]) {
    super(message);
    this.name = 'VMError';
  }
}

/**
 * Error thrown when a stack operation would cause a stack underflow.
 */
export class StackUnderflowError extends VMError {
  /**
   * Creates a new StackUnderflowError instance.
   * 
   * @param {string} operation - The operation that caused the underflow
   * @param {number} required - The number of elements required by the operation
   * @param {number[]} stackState - The state of the data stack at the time of the error
   */
  constructor(operation: string, public readonly required: number, stackState: number[]) {
    super(
      `Stack underflow: '${operation}' requires ${required} operand${required !== 1 ? 's' : ''} (stack: ${JSON.stringify(stackState)})`,
      stackState
    );
    this.name = 'StackUnderflowError';
  }
}

/**
 * Error thrown when a stack operation would cause a stack overflow.
 */
export class StackOverflowError extends VMError {
  /**
   * Creates a new StackOverflowError instance.
   * 
   * @param {string} operation - The operation that caused the overflow
   * @param {number[]} stackState - The state of the data stack at the time of the error
   */
  constructor(operation: string, stackState: number[]) {
    super(`Stack overflow: '${operation}' would exceed stack size`, stackState);
    this.name = 'StackOverflowError';
  }
}

/**
 * Error thrown when a return stack operation would cause a return stack underflow.
 */
export class ReturnStackUnderflowError extends VMError {
  /**
   * Creates a new ReturnStackUnderflowError instance.
   * 
   * @param {string} operation - The operation that caused the underflow
   * @param {number[]} stackState - The state of the data stack at the time of the error
   */
  constructor(operation: string, stackState: number[]) {
    super(`Return stack underflow: '${operation}' operation failed`, stackState);
    this.name = 'ReturnStackUnderflowError';
  }
}

/**
 * Error thrown when a return stack operation would cause a return stack overflow.
 */
export class ReturnStackOverflowError extends VMError {
  /**
   * Creates a new ReturnStackOverflowError instance.
   * 
   * @param {string} operation - The operation that caused the overflow
   * @param {number[]} stackState - The state of the data stack at the time of the error
   */
  constructor(operation: string, stackState: number[]) {
    super(`Return stack overflow: '${operation}' would exceed return stack size`, stackState);
    this.name = 'ReturnStackOverflowError';
  }
}

/**
 * Error thrown when an invalid opcode is encountered.
 */
export class InvalidOpcodeError extends VMError {
  /**
   * Creates a new InvalidOpcodeError instance.
   * 
   * @param {number} opcode - The invalid opcode
   * @param {number[]} stackState - The state of the data stack at the time of the error
   */
  constructor(public readonly opcode: number, stackState: number[]) {
    super(`Invalid opcode: ${opcode}`, stackState);
    this.name = 'InvalidOpcodeError';
  }
}

/**
 * Error thrown when an operation with an invalid tag is attempted.
 */
export class InvalidTagError extends VMError {
  /**
   * Creates a new InvalidTagError instance.
   * 
   * @param {number} tag - The invalid tag
   * @param {string} operation - The operation that was attempted
   * @param {number[]} stackState - The state of the data stack at the time of the error
   */
  constructor(public readonly tag: number, operation: string, stackState: number[]) {
    super(`Invalid tag ${tag} for operation '${operation}'`, stackState);
    this.name = 'InvalidTagError';
  }
}

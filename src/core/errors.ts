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
  constructor(
    message: string,
    public readonly stackState: number[],
  ) {
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
  constructor(
    operation: string,
    public readonly required: number,
    stackState: number[],
  ) {
    super(
      `Stack underflow: '${operation}' requires ${required} operand${required !== 1 ? 's' : ''} (stack: ${JSON.stringify(stackState)})`,
      stackState,
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
  constructor(
    public readonly opcode: number,
    stackState: number[],
  ) {
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
  constructor(
    public readonly tag: number,
    operation: string,
    stackState: number[],
  ) {
    super(`Invalid tag ${tag} for operation '${operation}'`, stackState);
    this.name = 'InvalidTagError';
  }
}

/**
 * Error thrown when an invalid opcode address is encountered during compilation or patching.
 */
export class InvalidOpcodeAddressError extends VMError {
  /**
   * Creates a new InvalidOpcodeAddressError instance.
   *
   * @param {number} address - The invalid opcode address
   */
  constructor(public readonly address: number) {
    super(`Invalid opcode address: ${address}`, []);
    this.name = 'InvalidOpcodeAddressError';
  }
}

/**
 * Base error class for all tokenizer-related errors.
 */
export class TokenError extends VMError {
  /**
   * Creates a new TokenError instance.
   *
   * @param {string} message - The error message
   * @param {number} line - The line number where the error occurred
   * @param {number} column - The column number where the error occurred
   */
  constructor(
    message: string,
    public readonly line: number,
    public readonly column: number,
  ) {
    super(`${message} at line ${line}, column ${column}`, []);
    this.name = 'TokenError';
  }
}

/**
 * Error thrown when a string literal is not properly terminated.
 */
export class UnterminatedStringError extends TokenError {
  /**
   * Creates a new UnterminatedStringError instance.
   *
   * @param {number} line - The line number where the error occurred
   * @param {number} column - The column number where the error occurred
   */
  constructor(line: number, column: number) {
    super(`Unterminated string literal`, line, column);
    this.name = 'UnterminatedStringError';
  }
}

/**
 * Base error class for all parser-related errors.
 */
export class ParserError extends VMError {
  /**
   * Creates a new ParserError instance.
   *
   * @param {string} message - The error message
   * @param {number[]} stackState - The state of the data stack at the time of the error
   */
  constructor(message: string, stackState: number[]) {
    super(message, stackState);
    this.name = 'ParserError';
  }
}

/**
 * Error thrown when a definition is not properly closed.
 */
export class UnclosedDefinitionError extends ParserError {
  /**
   * Creates a new UnclosedDefinitionError instance.
   *
   * @param {string} definitionName - The name of the unclosed definition
   * @param {number[]} stackState - The state of the data stack at the time of the error
   */
  constructor(
    public readonly definitionName: string,
    stackState: number[],
  ) {
    super(`Unclosed definition for ${definitionName}`, stackState);
    this.name = 'UnclosedDefinitionError';
  }
}

/**
 * Error thrown when an undefined word is encountered during parsing.
 */
export class UndefinedWordError extends ParserError {
  /**
   * Creates a new UndefinedWordError instance.
   *
   * @param {string} wordName - The name of the undefined word
   * @param {number[]} stackState - The state of the data stack at the time of the error
   */
  constructor(
    public readonly wordName: string,
    stackState: number[],
  ) {
    super(`Undefined word: ${wordName}`, stackState);
    this.name = 'UndefinedWordError';
  }
}

/**
 * Error thrown when a syntax error is encountered during parsing.
 */
export class SyntaxError extends ParserError {
  /**
   * Creates a new SyntaxError instance.
   *
   * @param {string} expected - The expected token or structure
   * @param {string} found - The token or structure that was found
   * @param {number[]} stackState - The state of the data stack at the time of the error
   */
  constructor(message: string, stackState: number[]) {
    super(message, stackState);
    this.name = 'SyntaxError';
  }
}

/**
 * Error thrown when nesting definitions inside code blocks, which is not allowed.
 */
export class NestedDefinitionError extends ParserError {
  /**
   * Creates a new NestedDefinitionError instance.
   *
   * @param {number[]} stackState - The state of the data stack at the time of the error
   */
  constructor(stackState: number[]) {
    super('Cannot nest definition inside code block', stackState);
    this.name = 'NestedDefinitionError';
  }
}

/**
 * Error thrown when a word is redefined.
 */
export class WordAlreadyDefinedError extends ParserError {
  /**
   * Creates a new WordAlreadyDefinedError instance.
   *
   * @param {string} wordName - The name of the word that was redefined
   * @param {number[]} stackState - The state of the data stack at the time of the error
   */
  constructor(
    public readonly wordName: string,
    stackState: number[],
  ) {
    super(`Word already defined: ${wordName}`, stackState);
    this.name = 'WordAlreadyDefinedError';
  }
}

/**
 * Error thrown when an unexpected token is encountered during parsing.
 */
export class UnexpectedTokenError extends ParserError {
  /**
   * Creates a new UnexpectedTokenError instance.
   *
   * @param {string} token - The unexpected token
   * @param {number[]} stackState - The state of the data stack at the time of the error
   */
  constructor(
    public readonly token: string,
    stackState: number[],
  ) {
    super(`Unexpected token: ${token}`, stackState);
    this.name = 'UnexpectedTokenError';
  }
}

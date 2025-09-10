/**
 * @file src/core/errors.ts
 * Structured error classes for the Tacit VM.
 */

/**
 * Base error class for VM-related errors.
 */
export class VMError extends Error {
  /**
   * Creates a new VMError instance.
   * @param message The error message
   * @param stackState Stack state at error time
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
 * Stack underflow error.
 */
export class StackUnderflowError extends VMError {
  /**
   * Creates StackUnderflowError.
   * @param operation Operation causing underflow
   * @param required Required operands
   * @param stackState Stack state
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
 * Stack overflow error.
 */
export class StackOverflowError extends VMError {
  /**
   * Creates StackOverflowError.
   * @param operation Operation causing overflow
   * @param stackState Stack state
   */
  constructor(operation: string, stackState: number[]) {
    super(`Stack overflow: '${operation}' would exceed stack size`, stackState);
    this.name = 'StackOverflowError';
  }
}

/**
 * Return stack underflow error.
 */
export class ReturnStackUnderflowError extends VMError {
  /**
   * Creates ReturnStackUnderflowError.
   * @param operation Operation causing underflow
   * @param stackState Stack state
   */
  constructor(operation: string, stackState: number[]) {
    super(`Return stack (RSP) underflow: '${operation}' operation failed`, stackState);
    this.name = 'ReturnStackUnderflowError';
  }
}

/**
 * Return stack overflow error.
 */
export class ReturnStackOverflowError extends VMError {
  /**
   * Creates ReturnStackOverflowError.
   * @param operation Operation causing overflow
   * @param stackState Stack state
   */
  constructor(operation: string, stackState: number[]) {
    super(`Return stack (RSP) overflow: '${operation}' would exceed return stack size`, stackState);
    this.name = 'ReturnStackOverflowError';
  }
}

/**
 * Invalid opcode error.
 */
export class InvalidOpcodeError extends VMError {
  /**
   * Creates InvalidOpcodeError.
   * @param opcode The invalid opcode
   * @param stackState Stack state
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
 * Invalid tag error.
 */
export class InvalidTagError extends VMError {
  /**
   * Creates InvalidTagError.
   * @param tag The invalid tag
   * @param operation The operation attempted
   * @param stackState Stack state
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
 * Invalid opcode address error.
 */
export class InvalidOpcodeAddressError extends VMError {
  /**
   * Creates InvalidOpcodeAddressError.
   * @param address The invalid address
   */
  constructor(public readonly address: number) {
    super(`Invalid opcode address: ${address}`, []);
    this.name = 'InvalidOpcodeAddressError';
  }
}

/**
 * Base tokenizer error.
 */
export class TokenError extends VMError {
  /**
   * Creates TokenError.
   * @param message Error message
   * @param line Line number
   * @param column Column number
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
 * Unterminated string error.
 */
export class UnterminatedStringError extends TokenError {
  /**
   * Creates UnterminatedStringError.
   * @param line Line number
   * @param column Column number
   */
  constructor(line: number, column: number) {
    super(`Unterminated string literal`, line, column);
    this.name = 'UnterminatedStringError';
  }
}

/**
 * Base parser error.
 */
export class ParserError extends VMError {
  /**
   * Creates ParserError.
   * @param message Error message
   * @param stackState Stack state
   */
  constructor(message: string, stackState: number[]) {
    super(message, stackState);
    this.name = 'ParserError';
  }
}

/**
 * Unclosed definition error.
 */
export class UnclosedDefinitionError extends ParserError {
  /**
   * Creates UnclosedDefinitionError.
   * @param definitionName Name of unclosed definition
   * @param stackState Stack state
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
 * Undefined word error.
 */
export class UndefinedWordError extends ParserError {
  /**
   * Creates UndefinedWordError.
   * @param wordName Name of undefined word
   * @param stackState Stack state
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
 * Syntax error.
 */
export class SyntaxError extends ParserError {
  /**
   * Creates SyntaxError.
   * @param message Error message
   * @param stackState Stack state
   */
  constructor(message: string, stackState: number[]) {
    super(message, stackState);
    this.name = 'SyntaxError';
  }
}

/**
 * Nested definition error.
 */
export class NestedDefinitionError extends ParserError {
  /**
   * Creates NestedDefinitionError.
   * @param stackState Stack state
   */
  constructor(stackState: number[]) {
    super('Cannot nest definition inside code block', stackState);
    this.name = 'NestedDefinitionError';
  }
}

/**
 * Word already defined error.
 */
export class WordAlreadyDefinedError extends ParserError {
  /**
   * Creates WordAlreadyDefinedError.
   * @param wordName Name of redefined word
   * @param stackState Stack state
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
 * Unexpected token error.
 */
export class UnexpectedTokenError extends ParserError {
  /**
   * Creates UnexpectedTokenError.
   * @param token The unexpected token
   * @param stackState Stack state
   */
  constructor(
    public readonly token: string,
    stackState: number[],
  ) {
    super(`Unexpected token: ${token}`, stackState);
    this.name = 'UnexpectedTokenError';
  }
}

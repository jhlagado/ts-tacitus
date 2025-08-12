/**
 * @file src/core/vm-errors.ts
 * Unified error handling system for C-port preparation.
 * Replaces 13+ custom error classes with simple error codes.
 */

import { VMResult } from './vm-types';

/**
 * Extended VM error codes for specific error types
 * Direct mapping to C enum vm_error_code
 */
export enum VMErrorCode {
  // Core VM errors (match VMResult)
  OK = 0,
  STACK_OVERFLOW = 1,
  STACK_UNDERFLOW = 2,
  RETURN_STACK_OVERFLOW = 3,
  RETURN_STACK_UNDERFLOW = 4,
  INVALID_OPCODE = 5,
  MEMORY_ACCESS_ERROR = 6,
  TYPE_ERROR = 7,
  
  // Extended error codes for specific situations
  INVALID_TAG = 8,
  INVALID_ADDRESS = 9,
  UNDEFINED_WORD = 10,
  WORD_REDEFINED = 11,
  UNCLOSED_DEFINITION = 12,
  NESTED_DEFINITION = 13,
  SYNTAX_ERROR = 14,
  UNTERMINATED_STRING = 15,
  UNEXPECTED_TOKEN = 16,
  SYMBOL_NOT_FOUND = 17
}

/**
 * VM error info structure (C-ready)
 * Direct mapping to C struct vm_error_info
 */
export interface VMErrorInfo {
  code: VMErrorCode;
  operation: string;
  message: string;
  stackDepth: number;
  line?: number;
  column?: number;
}

/**
 * Create error info for stack operations
 * Direct mapping to C function: vm_stack_error(code, operation, required)
 */
export function createStackError(
  code: VMErrorCode, 
  operation: string, 
  required: number,
  stackDepth: number
): VMErrorInfo {
  const plural = required !== 1 ? 's' : '';
  return {
    code,
    operation,
    message: `${operation} requires ${required} operand${plural} (stack depth: ${stackDepth})`,
    stackDepth
  };
}

/**
 * Create error info for parser operations  
 * Direct mapping to C function: vm_parser_error(code, message, line, column)
 */
export function createParserError(
  code: VMErrorCode,
  message: string,
  line?: number,
  column?: number
): VMErrorInfo {
  const location = (line !== undefined && column !== undefined) 
    ? ` at line ${line}, column ${column}` 
    : '';
  return {
    code,
    operation: 'parse',
    message: message + location,
    stackDepth: 0,
    line,
    column
  };
}

/**
 * Create error info for VM operations
 * Direct mapping to C function: vm_error(code, operation, message)
 */
export function createVMError(
  code: VMErrorCode,
  operation: string,
  message: string,
  stackDepth: number = 0
): VMErrorInfo {
  return {
    code,
    operation,
    message,
    stackDepth
  };
}

/**
 * Convert VMResult to VMErrorCode for compatibility
 * Direct mapping to C function: vm_result_to_error(result)
 */
export function vmResultToError(result: VMResult): VMErrorCode {
  return result as VMErrorCode; // Direct mapping since codes align
}

/**
 * Legacy error throwing function for backward compatibility
 * Will be phased out in favor of error codes
 */
export function throwLegacyError(errorInfo: VMErrorInfo, stackData: number[] = []): never {
  const { code, operation, message } = errorInfo;
  
  // Map to appropriate legacy error class for backward compatibility
  switch (code) {
    case VMErrorCode.STACK_UNDERFLOW:
      const stackUnderflowError = new Error(message);
      stackUnderflowError.name = 'StackUnderflowError';
      throw stackUnderflowError;
      
    case VMErrorCode.STACK_OVERFLOW:
      const stackOverflowError = new Error(message);
      stackOverflowError.name = 'StackOverflowError';
      throw stackOverflowError;
      
    case VMErrorCode.RETURN_STACK_UNDERFLOW:
      const rstackUnderflowError = new Error(message);
      rstackUnderflowError.name = 'ReturnStackUnderflowError';
      throw rstackUnderflowError;
      
    case VMErrorCode.RETURN_STACK_OVERFLOW:
      const rstackOverflowError = new Error(message);
      rstackOverflowError.name = 'ReturnStackOverflowError';
      throw rstackOverflowError;
      
    default:
      const vmError = new Error(message);
      vmError.name = 'VMError';
      throw vmError;
  }
}
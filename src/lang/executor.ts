/**
 * @file src/lang/executor.ts
 * Simple executor for Tacit language lines
 */

import { Interpreter } from './interpreter';
import { initializeInterpreter, vm } from '../core/globalState';

/**
 * Executes a single line of Tacit code
 * @param input The code to execute
 * @throws Error if execution fails
 */
export function executeLine(input: string): void {
  if (!input || input.trim() === '') {
    return; // Early return for empty input
  }
  
  try {
    const interpreter = new Interpreter(vm);
    interpreter.eval(input);
  } catch (error) {
    // Re-throw any errors from tokenizer, parser, or interpreter
    throw error;
  }
}

/**
 * Initialize the interpreter environment
 */
export function setupInterpreter(): void {
  initializeInterpreter();
}

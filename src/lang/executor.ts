/**
 * @file src/lang/executor.ts
 * 
 * This file provides high-level execution utilities for the Tacit language.
 * 
 * The executor serves as a bridge between the user interface components (like the REPL
 * or file processor) and the core interpreter. It provides simplified functions for
 * executing Tacit code and initializing the interpreter environment.
 */

import { Tokenizer } from './tokenizer';
import { parse } from './parser';
import { execute } from './interpreter';

import { initializeInterpreter, vm } from '../core/globalState';

/**
 * Executes a single line of Tacit code.
 * 
 * This function provides a simplified interface for executing Tacit code. It:
 * 1. Creates a tokenizer for the input string
 * 2. Parses the tokens into bytecode
 * 3. Executes the bytecode from the beginning of the compiled program
 * 
 * This is typically used by the REPL and other interactive interfaces.
 * 
 * @param input The Tacit code to execute as a string
 * @throws Error if tokenization, parsing, or execution fails
 */
export function executeLine(input: string): void {
  const tokenizer = new Tokenizer(input);
  parse(tokenizer);
  execute(vm.compiler.BCP);
}

/**
 * Initializes the interpreter environment.
 * 
 * This function sets up the global VM instance and its dependencies,
 * ensuring that the interpreter is ready to execute Tacit code.
 * It should be called once at the start of the application before
 * any Tacit code is executed.
 */
export function setupInterpreter(): void {
  initializeInterpreter();
}

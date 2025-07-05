/**
 * @file src/lang/parser.ts
 * Minimal parser for the simplified Forth-like Tacit language
 */

import { vm } from '../core/globalState';
import { Tokenizer } from './tokenizer';
import { Interpreter } from './interpreter';

/**
 * Main parse function - entry point for parsing Tacit code
 */
export function parse(tokenizer: Tokenizer): void {
  // Create an interpreter and evaluate the input
  // The tokenizer already handles comments correctly
  const interpreter = new Interpreter(vm);
  interpreter.eval(tokenizer.input);
}

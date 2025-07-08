import { Tokenizer } from './tokenizer';
import { parse } from './parser';
import { execute } from './interpreter';
import { initializeInterpreter, vm } from '../core/globalState';

/**
 * Executes a single line of Tacit code
 * @param input The code to execute
 * @throws Error if execution fails
 */

export function executeLine(input: string): void {
  const tokenizer = new Tokenizer(input);
  parse(tokenizer);
  execute(vm.compiler.BCP);
}

/**
 * Initialize the interpreter environment
 */

export function setupInterpreter(): void {
  initializeInterpreter();
}

import { type VM } from '../core/vm';
import { parse } from './parser';
import { execute } from './interpreter';
import { Tokenizer } from './tokenizer';

/**
 * Parses and executes a string of Tacit code.
 *
 * This function provides a high-level entry point for running Tacit programs.
 * It tokenizes and parses the input code, then executes the resulting bytecode.
 *
 * @param {VM} vm - The VM instance to use
 * @param {string} code - The Tacit source code to execute
 */
export function executeProgram(vm: VM, code: string): void {
  parse(vm, new Tokenizer(code));
  execute(vm, vm.compiler.BCP);
}

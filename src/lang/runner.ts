import { type VM } from '../core/vm';
import { parse } from './parser';
import { execute } from './interpreter';
import { createTokenizer } from './tokenizer';

/**
 * Parses and executes a string of Tacit code.
 *
 * This function provides a high-level entry point for running Tacit programs.
 * It tokenizes and parses the input code, then executes the resulting bytecode.
 *
 * @param {VM} vm - The VM instance to use
 * @param {string} code - The Tacit source code to execute
 * @param {string} [sourceName] - Optional canonical source identifier (for include base)
 */
export function executeProgram(vm: VM, code: string, sourceName?: string): void {
  parse(vm, createTokenizer(code), sourceName);
  execute(vm, vm.compile.BCP);
}

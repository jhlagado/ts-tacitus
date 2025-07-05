/**
 * @file src/lang/interpreter.ts
 * A minimal interpreter for the Forth-like Tacit language
 */

import { VM } from '../core/vm';
import { SymbolTable } from '../strings/symbol-table';

/**
 * A simplified interpreter for the Forth-like Tacit language
 */
export class Interpreter {
  vm: VM;
  symbolTable: SymbolTable;

  constructor(vm: VM) {
    this.vm = vm;
    this.symbolTable = vm.symbolTable;
  }

  /**
   * Parse and evaluate a Tacit expression
   */
  eval(expression: string): number | undefined {
    // Tokenize the input
    const tokens = this.tokenize(expression);

    // Process each token
    for (const token of tokens) {
      // Try to find the token in the symbol table
      const entry = this.symbolTable.find(token);

      if (entry !== null && entry !== undefined) {
        // Execute the symbol's operation
        entry(this.vm);
      } else if (this.isFloat(token)) {
        // Push all numbers as raw float32 values (not NaN-boxed)
        const value = parseFloat(token);
        this.vm.push(value);
      } else if (token === '.s') {
        // Special command to print the stack (for debugging)
        console.log('Stack:', this.vm.getStackData());
      } else {
        throw new Error(`Unknown token: ${token}`);
      }
    }

    // Return the top value of the stack if available
    if (this.vm.SP > 0) {
      return this.vm.peek();
    }

    return undefined;
  }

  /**
   * Tokenize a string into an array of tokens
   */
  private tokenize(input: string): string[] {
    // Split by whitespace, filtering out empty strings
    return input
      .trim()
      .split(/\s+/)
      .filter(token => token.length > 0);
  }

  /**
   * Check if a string represents an integer
   */
  private isInteger(str: string): boolean {
    return /^-?\d+$/.test(str);
  }

  /**
   * Check if a string represents a floating-point number
   */
  private isFloat(str: string): boolean {
    // Match integers or floating-point numbers (including negative numbers)
    return /^-?\d+(\.\d+)?$/.test(str);
  }
}

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
  
  // Colon definition state
  private isCompiling: boolean = false;
  private currentDefinition: string | null = null;
  private definitionTokens: string[] = [];

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
    let i = 0;

    while (i < tokens.length) {
      const token = tokens[i];
      
      // Handle colon definition start
      if (token === ':' && !this.isCompiling) {
        // Next token should be the word name
        i++;
        if (i >= tokens.length) {
          throw new Error('Expected word name after colon');
        }
        
        const wordName = tokens[i];
        
        // Validate word name (can't be a number)
        if (this.isFloat(wordName)) {
          throw new Error(`Invalid word name: ${wordName}. Word names cannot be numbers.`);
        }
        
        // Start new definition
        this.isCompiling = true;
        this.currentDefinition = wordName;
        this.definitionTokens = [];
        i++;
        continue;
      }
      
      // Handle semicolon (end of definition)
      if (token === ';' && this.isCompiling) {
        if (!this.currentDefinition) {
          throw new Error('Unexpected semicolon outside of definition');
        }
        
        // Define the new word
        this.defineNewWord();
        
        // Reset compilation state
        this.isCompiling = false;
        this.currentDefinition = null;
        i++;
        continue;
      }
      
      // If we're in a definition, collect tokens
      if (this.isCompiling) {
        this.definitionTokens.push(token);
        i++;
        continue;
      }
      
      // Regular execution
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
      
      i++;
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
  
  /**
   * Defines a new word from the collected tokens
   */
  private defineNewWord(): void {
    if (!this.currentDefinition || this.definitionTokens.length === 0) {
      throw new Error('Invalid word definition');
    }
    
    // Create a copy of the tokens to avoid reference issues
    const tokens = [...this.definitionTokens];
    
    // Define the new word in the symbol table
    this.symbolTable.define(this.currentDefinition, (vm: VM) => {
      // Create a new interpreter instance for this execution
      const interpreter = new Interpreter(vm);
      
      try {
        // Execute each token in the definition
        interpreter.eval(tokens.join(' '));
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(`Error in word '${this.currentDefinition}': ${errorMessage}`);
      }
    });
    
    if (this.vm.debug) {
      console.log(`Defined new word: ${this.currentDefinition} = ${tokens.join(' ')}`);
    }
  }
}

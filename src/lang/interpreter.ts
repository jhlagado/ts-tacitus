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
    
    // Add built-in operations
    this.initializeBuiltins();
  }
  
  /**
   * Initialize built-in operations
   */
  private initializeBuiltins(): void {
    // Add the 'do' operation
    // The actual implementation is handled in the eval method, but we need to define it
    // to prevent 'unknown token' errors
    this.symbolTable.define('do', (_vm: VM) => {
      // Implementation is in the eval method
    });
    
    // Add basic arithmetic operations
    this.symbolTable.define('+', (vm: VM) => {
      const b = vm.pop();
      const a = vm.pop();
      vm.push(a + b);
    });

    this.symbolTable.define('*', (vm: VM) => {
      const b = vm.pop();
      const a = vm.pop();
      vm.push(a * b);
    });

    // Stack manipulation operations
    this.symbolTable.define('dup', (vm: VM) => {
      const a = vm.pop();
      vm.push(a);
      vm.push(a);
    });

    this.symbolTable.define('swap', (vm: VM) => {
      const b = vm.pop();
      const a = vm.pop();
      vm.push(b);
      vm.push(a);
    });

    this.symbolTable.define('drop', (vm: VM) => {
      vm.pop();
    });
    
    // Add the '}' operation (needed to properly handle block end)
    this.symbolTable.define('}', (_vm: VM) => {
      // This is a no-op, just needed to prevent 'unknown token' errors
    });
    
    // Add 'over' operation (duplicates the second item to the top)
    this.symbolTable.define('over', (vm: VM) => {
      const a = vm.pop();
      const b = vm.peek();
      vm.push(a);
      vm.push(b);
    });
    
    // Add 'rot' operation (rotates the top three items)
    this.symbolTable.define('rot', (vm: VM) => {
      const c = vm.pop();
      const b = vm.pop();
      const a = vm.pop();
      vm.push(b);
      vm.push(c);
      vm.push(a);
    });
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
      
          // Handle do loops
      if (token.toLowerCase() === 'do') {
        // Skip the 'do' token
        i++;
        
        // The next token should be a block
        if (i >= tokens.length || tokens[i] !== '{') {
          throw new Error('Expected block after "do"');
        }
        
        // Skip the '{' token
        i++;
        
        // Find the end of the block
        let blockStart = i;
        let blockLevel = 1;
        
        while (i < tokens.length && blockLevel > 0) {
          if (tokens[i] === '{') blockLevel++;
          if (tokens[i] === '}') blockLevel--;
          if (blockLevel > 0) i++;
        }
        
        // If we didn't find a matching '}', throw an error
        if (blockLevel > 0) {
          throw new Error('Unterminated block starting at token ' + blockStart);
        }
        
        // Save the current token position
        const savedI = i;
        
        // Extract the block content (excluding the closing '}')
        const blockTokens = tokens.slice(blockStart, i - 1);
        
        // The top of the stack is the loop count, below it is the initial value
        const count = Math.floor(this.vm.pop());
        let currentValue = this.vm.pop();
        
        console.log('Do loop: count =', count, 'initial value =', currentValue, 'block tokens =', blockTokens);
        
        // For zero iterations, just leave the initial value on the stack
        if (count <= 0) {
          this.vm.push(currentValue);
          i = savedI;
          continue;
        }
        
        // Execute the block 'count' times
        for (let j = 0; j < count; j++) {
          console.log('Iteration', j + 1, 'of', count, 'current value =', currentValue);
          
          // Push the current value for the block to use
          this.vm.push(currentValue);
          console.log('Pushed current value to stack. Stack size =', this.vm.getStackSize());
          
          // Execute each token in the block
          for (let k = 0; k < blockTokens.length; k++) {
            const currentToken = blockTokens[k];
            console.log('  Executing token:', currentToken);
            
            const entry = this.symbolTable.find(currentToken);
            
            if (entry !== null && entry !== undefined) {
              console.log('    Found symbol table entry:', entry);
              entry(this.vm);
              console.log('    After execution, stack size =', this.vm.getStackSize());
            } else if (this.isFloat(currentToken)) {
              console.log('    Pushing float value:', parseFloat(currentToken));
              this.vm.push(parseFloat(currentToken));
              console.log('    After push, stack size =', this.vm.getStackSize());
            } else {
              throw new Error(`Unknown word: ${currentToken}`);
            }
          }
          
          // The block should leave exactly one value on the stack
          if (this.vm.getStackSize() === 0) {
            throw new Error('Block must leave a value on the stack');
          }
          
          // Get the new value for the next iteration
          currentValue = this.vm.pop();
          console.log('  Popped new value:', currentValue, 'Stack size =', this.vm.getStackSize());
        }
        
        // Push the final result
        console.log('Final value:', currentValue);
        this.vm.push(currentValue);
        
        // Restore the token position
        i = savedI;
        
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
   * Tokenize a string into an array of tokens, handling blocks
   */
  private tokenize(input: string): string[] {
    const tokens: string[] = [];
    let currentToken = '';
    let inString = false;
    let inBlock = 0;
    let inComment = false;
    
    for (let i = 0; i < input.length; i++) {
      const char = input[i];
      
      // Handle comments
      if (char === '\\' && !inString && !inBlock) {
        inComment = true;
        continue;
      }
      
      if (inComment) {
        if (char === '\n') {
          inComment = false;
        }
        continue;
      }
      
      // Handle string literals
      if (char === '"' && !inBlock) {
        inString = !inString;
        currentToken += char;
        continue;
      }
      
      // If we're in a string, just add the character
      if (inString) {
        currentToken += char;
        continue;
      }
      
      // Handle blocks
      if (char === '{') {
        if (inBlock === 0) {
          // Save current token if any
          if (currentToken.trim()) {
            tokens.push(currentToken.trim());
            currentToken = '';
          }
          tokens.push('{');
        } else {
          currentToken += char;
        }
        inBlock++;
      } else if (char === '}') {
        inBlock--;
        if (inBlock === 0) {
          // Save block content
          if (currentToken.trim()) {
            tokens.push(currentToken.trim());
            currentToken = '';
          }
          tokens.push('}');
        } else {
          currentToken += char;
        }
      } else if (/\s/.test(char) && inBlock === 0) {
        // Handle whitespace outside of blocks
        if (currentToken) {
          tokens.push(currentToken);
          currentToken = '';
        }
      } else {
        currentToken += char;
      }
    }
    
    // Add the last token if there is one
    if (currentToken) {
      tokens.push(currentToken);
    }
    
    return tokens.filter(token => token.trim().length > 0);
  }

  /**
   * Check if a string represents an integer
   */
  private isFloat(str: string): boolean {
    // Match integers or floating-point numbers (including negative numbers)
    return /^[-+]?\d*(\.\d+)?$/.test(str);
  }
  
  /**
   * Defines a new word from the collected tokens
   */
  private defineNewWord(): void {
    if (!this.currentDefinition) {
      throw new Error('Invalid word definition: missing name');
    }
    
    // Create a copy of the tokens to avoid reference issues
    const tokens = [...this.definitionTokens];
    
    // Define the new word in the symbol table
    this.symbolTable.define(this.currentDefinition, (vm: VM) => {
      // If there are no tokens, it's a no-op word
      if (tokens.length === 0) {
        return;
      }
      
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

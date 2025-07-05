/**
 * @file src/lang/repl.ts
 * A simple REPL (Read-Eval-Print-Loop) for the minimal Forth-like Tacit language
 */

import * as readline from 'readline';
import { executeLine, setupInterpreter } from './executor';
import { vm } from '../core/globalState';
import { formatValue } from '../core/utils';
import { processFile } from './fileProcessor';

/**
 * A simple REPL for interacting with the Tacit language
 */
export class REPL {
  rl: readline.Interface;

  constructor() {
    // Initialize a fresh interpreter
    setupInterpreter();
    
    // Create readline interface
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: 'tacit> '
    });
  }

  /**
   * Start the REPL
   */
  start(): void {
    console.log('Minimal Tacit Language REPL');
    console.log('Type ".help" for available commands');
    this.rl.prompt();

    this.rl.on('line', (line) => {
      const input = line.trim();
      
      if (input === '') {
        // Empty input, just show prompt again
        this.rl.prompt();
        return;
      }
      
      if (input === '.exit' || input === '.quit') {
        // Exit command
        this.rl.close();
        return;
      }
      
      if (input === '.reset') {
        // Reset the interpreter
        setupInterpreter();
        console.log('Interpreter reset');
        this.rl.prompt();
        return;
      }
      
      // Load a Tacit file
      if (input.startsWith('.load ')) {
        const filename = input.substring(6).trim();
        try {
          const success = processFile(filename);
          if (success) {
            console.log(`File ${filename} loaded successfully.`);
          } else {
            console.log(`File ${filename} had errors but REPL will continue.`);
          }
        } catch (error) {
          console.error('Error loading file:');
          if (error instanceof Error) {
            console.error(`  ${error.message}`);
          } else {
            console.error(`  ${String(error)}`);
          }
        }
        this.rl.prompt();
        return;
      }
      
      if (input === '.help') {
        // Show help text
        console.log('Available commands:');
        console.log('  .help     - Show this help message');
        console.log('  .exit     - Exit the REPL');
        console.log('  .quit     - Exit the REPL');
        console.log('  .reset    - Reset the interpreter state');
        console.log('  .load     - Load and execute a Tacit file');
        console.log('  .s        - Print the current stack contents');
        console.log('\nBasic Forth-like operations:');
        console.log('  dup, drop, swap, over, rot');
        console.log('  +, -, *, /, mod');
        console.log('  =, <, >');
        console.log('  if');
        console.log('\nComments:');
        console.log('  \\ This is a comment (everything after \\ on a line is ignored)')
        this.rl.prompt();
        return;
      }
      
      if (input === '.s') {
        // Print the stack
        const stack = vm.getStackData();
        console.log('Stack:', stack.map(val => formatValue(vm, val)));
        this.rl.prompt();
        return;
      }
      
      try {
        // Evaluate the input using the executor
        executeLine(input);
        // We don't show a result here as executeLine handles output
      } catch (error) {
        // Print any errors
        if (error instanceof Error) {
          console.error('Error:', error.message);
        } else {
          console.error('Unknown error occurred');
        }
      }
      
      this.rl.prompt();
    });

    this.rl.on('close', () => {
      console.log('Goodbye!');
      process.exit(0);
    });
  }
}

// If this module is run directly, start the REPL
if (require.main === module) {
  const repl = new REPL();
  repl.start();
}

/**
 * Start a REPL session
 * @param files Optional files to process before starting the REPL
 * @param interactiveAfterFiles Whether to enter interactive mode after processing files
 */
export function startREPL(files?: string[], interactiveAfterFiles: boolean = true): void {
  // Initialize interpreter
  setupInterpreter();
  
  // Process files if provided
  let allFilesSucceeded = true;
  
  if (files && files.length > 0) {
    console.log(`Loading ${files.length} file(s)...`);
    
    for (const file of files) {
      try {
        const success = processFile(file);
        if (!success) {
          console.error(`Error processing file: ${file}`);
          allFilesSucceeded = false;
        }
      } catch (error) {
        console.error(`Error processing file: ${file}`);
        if (error instanceof Error) {
          console.error(`  ${error.message}`);
        } else {
          console.error('  Unknown error');
        }
        allFilesSucceeded = false;
      }
    }
    
    if (allFilesSucceeded) {
      console.log('All files loaded successfully.');
    } else {
      console.log('Some files had errors.');
    }
  }
  
  // Enter interactive mode if requested
  if (!files || files.length === 0 || interactiveAfterFiles) {
    console.log('Entering Interactive mode...');
    const repl = new REPL();
    repl.start();
  }
}

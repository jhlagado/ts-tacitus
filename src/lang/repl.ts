/**
 * @file src/lang/repl.ts
 *
 * This file implements the Read-Eval-Print Loop (REPL) for the Tacit language.
 *
 * The REPL provides an interactive command-line interface for executing Tacit code.
 * It supports loading files, executing individual commands, and maintaining an
 * interactive session. This is the primary interface for interactive development
 * and experimentation with the Tacit language.
 */

import { createInterface } from 'readline';
import type { VM } from '../core/vm';
import { createVM } from '../core/vm';
import { parse } from './parser';
import { execute } from './interpreter';
import { Tokenizer } from './tokenizer';
import { processFile } from './file-processor';

/**
 * Starts an interactive REPL (Read-Eval-Print Loop) session.
 *
 * This function initializes the interpreter environment and starts an interactive
 * command-line interface for executing Tacit code. It can optionally load files
 * before starting the interactive session.
 *
 * The REPL supports the following commands:
 * - 'exit': Exits the REPL
 * - 'load <filepath>': Loads and executes a Tacit file
 * - Any other input is interpreted as Tacit code and executed
 *
 * @param {string[]} [files=[]] - Array of file paths to load before starting the interactive session
 * @param {boolean} [interactiveAfterFiles=true] - Whether to start an interactive session after loading files
 */
export function startREPL(files: string[] = [], interactiveAfterFiles = true): void {
  const vm = createVM();
  let allFilesProcessed = true;
  if (files.length > 0) {
    // eslint-disable-next-line no-console
    console.log(`Loading ${files.length} file(s)...`);
    for (const file of files) {
      const success = processFile(vm, file);
      if (!success) {
        console.error(`Error processing file: ${file}`);
        allFilesProcessed = false;
      }
    }

    if (allFilesProcessed) {
      // eslint-disable-next-line no-console
      console.log('All files loaded successfully.');
    } else {
      // eslint-disable-next-line no-console
      console.log('Some files had errors but REPL will continue.');
    }
  }

  if (!interactiveAfterFiles) {
    return;
  }

  // eslint-disable-next-line no-console
  console.log("Interactive mode (type 'exit' to quit, 'load <filepath>' to load a file):");
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '> ',
  });

  rl.prompt();
  rl.on('line', line => {
    const command = line.trim();
    if (command === 'exit') {
        // eslint-disable-next-line no-console
        console.log('Goodbye!');
      rl.close();
      return;
    }

    if (command.startsWith('load ')) {
      const filePath = command.substring(5).trim();
      try {
        const success = processFile(vm, filePath);
        if (!success) {
          // eslint-disable-next-line no-console
          console.log('File processing encountered errors but REPL will continue.');
        }
      } catch (error) {
        console.error('Error loading file:');
        if (error instanceof Error) {
          console.error(`  ${error.message}`);
        }
        console.log('File processing encountered errors but REPL will continue.');
      }
      rl.prompt();
      return;
    }

    try {
      const tokenizer = new Tokenizer(command);
      parse(vm, tokenizer);
      execute(vm, vm.compiler.BCP);
    } catch (error) {
      if (error instanceof Error) {
        console.error(`Error: ${error.message}`);
      } else {

        console.error('Unknown error occurred');
      }
    }
    rl.prompt();
  });
  rl.on('close', () => {
    // eslint-disable-next-line no-console
    console.log('REPL exited.');
  });
}

/**
 * Main entry point for the Tacit interpreter.
 *
 * This function processes command-line arguments and starts the REPL accordingly.
 * It supports the following command-line options:
 * - '--no-interactive': Loads files without starting an interactive session
 * - Any other arguments are treated as file paths to load
 *
 * If no files are specified, it starts an interactive REPL session.
 */
export function main(): void {
  const args = process.argv.slice(2);
  const noInteractiveIndex = args.indexOf('--no-interactive');
  const interactiveAfterFiles = noInteractiveIndex === -1;
  const files = args.filter(arg => !arg.startsWith('--'));
  if (files.length === 0) {
    startREPL();
  } else {
    startREPL(files, interactiveAfterFiles);
  }
}

if (require.main === module) {
  main();
}

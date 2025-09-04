/**
 * @file src/cli.ts
 *
 * This file implements the command-line interface for the Tacit VM.
 *
 * The CLI serves as the main entry point for the Tacit VM, providing two modes of operation:
 * 1. Interactive REPL (Read-Eval-Print Loop) mode when no files are specified
 * 2. File execution mode when one or more files are provided as arguments
 *
 * Command-line arguments:
 * - File paths: Any arguments not starting with '--' are treated as file paths to execute
 * - --no-interactive: When specified, prevents entering REPL mode after executing files
 */

import { startREPL } from './lang/repl';
import { processFiles } from './lang/fileProcessor';

import { initializeInterpreter } from './lang/runtime';

/**
 * Main entry point for the CLI.
 *
 * This function initializes the interpreter environment and processes command-line arguments
 * to determine the execution mode:
 *
 * 1. If no files are specified, it starts the REPL in interactive mode
 * 2. If files are specified:
 *    - With default behavior, it executes the files and then enters REPL mode
 *    - With --no-interactive flag, it executes the files and exits
 *
 * @example
 *
 * $ node dist/cli.js
 *
 * @example
 *
 * $ node dist/cli.js examples/hello.tacit
 *
 * @example
 *
 * $ node dist/cli.js examples/file1.tacit examples/file2.tacit --no-interactive
 */
export function main(): void {
  initializeInterpreter();
  const args = process.argv.slice(2);
  const noInteractiveIndex = args.indexOf('--no-interactive');
  const interactiveAfterFiles = noInteractiveIndex === -1;
  const files = args.filter(arg => !arg.startsWith('--'));
  if (files.length === 0) {
    startREPL();
  } else {
    if (interactiveAfterFiles) {
      startREPL(files, true);
    } else {
      processFiles(files);
    }
  }
}

if (require.main === module) {
  main();
}

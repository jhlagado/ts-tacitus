import { startREPL } from './lang/repl';
import { processFiles } from './lang/fileProcessor';

/**
 * Main entry point for the CLI
 */
export function main(): void {
  const args = process.argv.slice(2);

  // Check for a --no-interactive flag
  const noInteractiveIndex = args.indexOf('--no-interactive');
  const interactiveAfterFiles = noInteractiveIndex === -1;

  // Remove flags from the args list
  const files = args.filter(arg => !arg.startsWith('--'));

  if (files.length === 0) {
    // No files specified, start in interactive mode only
    startREPL();
  } else {
    if (interactiveAfterFiles) {
      // Process files and then enter interactive mode
      startREPL(files, true);
    } else {
      // Process files only (no interactive mode)
      processFiles(files);
    }
  }
}

// Allow direct execution from command line
if (require.main === module) {
  main();
}

import { startREPL } from './lang/repl';
import { processFiles } from './lang/fileProcessor';

import { initializeInterpreter } from './core/globalState';

/**
 * Main entry point for the CLI
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

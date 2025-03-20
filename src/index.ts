import { startREPL } from "./core/repl";
import { runFiles } from "./core/runner";

function main(): void {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    // No arguments - start interactive REPL
    startREPL();
  } else {
    // Arguments provided - run files
    runFiles(args);
  }
}

// Allow direct execution from command line
if (require.main === module) {
  main();
}

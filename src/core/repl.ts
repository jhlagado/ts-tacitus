import { createInterface } from "readline";
import { execute } from "./interpreter";
import { parse } from "./parser";
import { lex } from "./lexer";
import { initializeInterpreter, vm } from "./globalState";
import { processFile } from "./runner";

/**
 * Starts the Read-Eval-Print Loop (REPL) for the interpreter.
 * @param files Optional array of file paths to process before starting interactive mode
 * @param interactiveAfterFiles Whether to enter interactive mode after processing files
 */
export function startREPL(
  files: string[] = [],
  interactiveAfterFiles: boolean = true
): void {
  initializeInterpreter();

  // Process files if provided
  if (files.length > 0) {
    console.log("File processing mode:");
    for (const file of files) {
      const success = processFile(file);
      if (!success) {
        console.log("Processing stopped due to error.");
        process.exit(1); // Exit with error code in file mode
      }
    }
    console.log("All files processed successfully.");

    // Exit if we're not supposed to enter interactive mode after
    if (!interactiveAfterFiles) {
      return;
    }
  }

  // Start interactive mode
  console.log(
    "Interactive mode (type 'exit' to quit, 'load <filepath>' to load a file):"
  );

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "> ",
  });

  rl.prompt();

  rl.on("line", (line) => {
    const command = line.trim();

    if (command === "exit") {
      console.log("Goodbye!");
      rl.close();
      return; // Ensure no further processing happens
    }

    // Add support for loading files during interactive mode
    if (command.startsWith("load ")) {
      const filePath = command.substring(5).trim();
      try {
        // In interactive mode, we don't exit on file errors, just report them
        const success = processFile(filePath);
        if (!success) {
          console.log(
            "File processing encountered errors but REPL will continue."
          );
        }
      } catch (error) {
        console.error("Error loading file:");
        if (error instanceof Error) {
          console.error(`  ${error.message}`);
        }
      }
      rl.prompt();
      return;
    }

    try {
      const tokens = lex(command); // Tokenize the input string
      parse(tokens); // Parse the tokens into a buffer of instructions
      execute(vm.compiler.BP);
    } catch (error) {
      if (error instanceof Error) {
        console.error(`Error: ${error.message}`);
      } else {
        console.error("Unknown error occurred");
      }
      // In interactive mode, we continue after errors
    }

    rl.prompt();
  });

  rl.on("close", () => {
    console.log("REPL exited.");
  });
}

/**
 * Main entry point for the interpreter
 */
export function main(): void {
  const args = process.argv.slice(2);

  // Check for a --no-interactive flag
  const noInteractiveIndex = args.indexOf("--no-interactive");
  const interactiveAfterFiles = noInteractiveIndex === -1;

  // Remove flags from the args list
  const files = args.filter((arg) => !arg.startsWith("--"));

  if (files.length === 0) {
    // No files specified, start in interactive mode only
    startREPL();
  } else {
    // Process files and conditionally go to interactive mode
    startREPL(files, interactiveAfterFiles);
  }
}

// Allow direct execution from command line
if (require.main === module) {
  main();
}

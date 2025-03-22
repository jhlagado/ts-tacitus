import { createInterface } from "readline";
import { executeLine, setupInterpreter } from "./executor";
import { processFile } from "./fileProcessor";

/**
 * Starts an interactive REPL session
 */
export function startREPL(
  files: string[] = [],
  interactiveAfterFiles: boolean = true
): void {
  setupInterpreter();

  // Process any files provided
  let allFilesProcessed = true;
  if (files.length > 0) {
    console.log(`Loading ${files.length} file(s)...`);

    for (const file of files) {
      const success = processFile(file);
      if (!success) {
        console.error(`Error processing file: ${file}`);
        allFilesProcessed = false;
      }
    }

    if (allFilesProcessed) {
      console.log("All files loaded successfully.");
    } else {
      console.log("Some files had errors but REPL will continue.");
    }
  }

  // Exit if not interactive mode after files
  if (!interactiveAfterFiles) {
    return;
  }

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
      return;
    }

    // Add support for loading files during interactive mode
    if (command.startsWith("load ")) {
      const filePath = command.substring(5).trim();
      try {
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
      executeLine(command);
    } catch (error) {
      if (error instanceof Error) {
        console.error(`Error: ${error.message}`);
      } else {
        console.error("Unknown error occurred");
      }
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

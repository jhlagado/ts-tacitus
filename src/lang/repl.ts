import { createInterface } from "readline";
import { execute } from "./interpreter";
import { parse } from "./parser";
import { lex } from "./lexer";
import { initializeInterpreter, vm } from "../core/globalState";

/**
 * Starts the Read-Eval-Print Loop (REPL) for the interpreter.
 */
export function startREPL(): void {
  initializeInterpreter();

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
    }

    rl.prompt();
  });

  rl.on("close", () => {
    console.log("REPL exited.");
  });
}

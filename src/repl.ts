import { createInterface } from "readline";
import { execute } from "./interpreter";
import { parse } from "./parser";
import { lex } from "./lexer";
import { initializeInterpreter } from "./globalState";
import { getItems, reset } from "./memory";
import { vm } from "./globalState";

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
      reset(vm.buffer);
      const tokens = lex(command); // Tokenize the input string
      parse(tokens); // Parse the tokens into a buffer of instructions
      vm.IP.ofs = vm.buffer.base;
      execute();
      console.log(getItems(vm.stack));
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

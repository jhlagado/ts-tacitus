import readline from "readline";
import { execute } from "./interpreter";

export function startREPL(): void {
    const rl = readline.createInterface({
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
  
      const result = execute(command);
      console.log(result);
      rl.prompt();
    });
  
    rl.on("close", () => {
      console.log("REPL exited.");
    });
  }
  
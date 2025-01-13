// src/interpreter.ts
import { vm } from "./globalState";
import { immediateWords, ops } from "./builtins"; // Import Op enum

export function execute(start: number): void {
  vm.IP = start;
  while (vm.running) {
    const opcode = vm.next(); // opcode is a number
    if (vm.compiler.compileMode && !immediateWords.includes(opcode)) {
      // Compile the verb index if not an immediate word
      vm.compiler.compileCode(opcode);
    } else {
      const verb = ops[opcode]; // Resolve the verb using ops array
      if (verb === undefined) {
        throw new Error(`Invalid opcode: ${opcode}`);
      }
      try {
        verb(vm);
      } catch (error) {
        const stackState = JSON.stringify(vm.getStackData());
        const errorMessage =
          `Unknown error executing word (stack: ${stackState})` +
          (error instanceof Error ? `: ${error.message}` : ""); // Add a space after the colon
        throw new Error(errorMessage);
      }
    }
  }
}

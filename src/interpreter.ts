import { vm } from "./globalState";
import { immediateWords } from "./builtins";
import { getItems, next, push, reset } from "./memory";
import { isVerb } from "./utils";

/**
 * Executes a command.
 * @param command - The command to execute.
 * @throws {Error} If an unknown word is encountered.
 */
export function execute(): void {
  // Infinite loop: rely on words to control the IP
  reset(vm.buffer);
  vm.IP.ofs = vm.buffer.base;
  while (vm.running) {
    const cell = next(vm.IP);
    // console.log("item", cell);
    if (cell === undefined) throw new Error("Unexpected end of buffer");
    if (typeof cell === "number")
      throw new Error("Unexpected number in buffer");
    if (isVerb(cell)) {
      // console.log("immediate", immediateWords.includes(cell));
      if (vm.compileMode && !immediateWords.includes(cell)) {
        push(vm.compileBuffer, cell);
      } else {
        try {
          cell();
        } catch (error) {
          const stackState = JSON.stringify(getItems(vm.stack));
          const errorMessage =
            `Unknown error executing word (stack: ${stackState})` +
            (error instanceof Error ? `:${error.message}` : "");
          throw new Error(errorMessage);
        }
      }
    } else if (typeof cell === "number") {
      throw new Error(`Unexpected number: ${cell}`);
    } else {
      throw new Error(`Unexpected object: ${JSON.stringify(cell)}`);
    }
  }
}

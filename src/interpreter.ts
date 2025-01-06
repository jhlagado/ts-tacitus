import { vm } from "./globalState";
import { immediateWords } from "./builtins";
import { Verb } from "./types";

export function executeWord(word: Verb): void {
  try {
    word();
  } catch (error) {
    const stackState = vm.stack; // Capture the current stack state
    const errorMessage =
      error instanceof Error
        ? `Error executing word (stack: ${JSON.stringify(stackState)}): ${
            error.message
          }`
        : `Unknown error executing word (stack: ${JSON.stringify(stackState)})`;
    throw new Error(errorMessage); // Rethrow with additional context
  }
}

/**
 * Executes a command.
 * @param command - The command to execute.
 * @throws {Error} If an unknown word is encountered.
 */
export function execute(buffer: (number | Verb)[]): void {
  // Reset the IP to the start of the buffer
  vm.IP = 0;

  // Infinite loop: rely on words to control the IP
  while (vm.running) {
    const word = buffer[vm.IP++];
    console.log("item", word);
    if (word === undefined) throw new Error("Unexpected end of buffer");
    if (typeof word === "number")
      throw new Error("Unexpected number in buffer");
    if (!vm.compileMode || immediateWords.includes(word)) executeWord(word);
    else vm.compileBuffer.push(word);
  }
}

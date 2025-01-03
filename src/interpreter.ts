import { Stack, createStack, push, getItems } from "./stack";
import { Dictionary, createDictionary, define, find } from "./dictionary";
import { tokenize } from "./lexer";
import { builtins } from "./builtins"; // Import built-in words

let stack: Stack<number> = createStack<number>();
let dictionary: Dictionary = createDictionary();

/**
 * Initializes the Forth interpreter by loading built-in words.
 */
export function initializeInterpreter(): void {
  stack = createStack<number>();
  dictionary = createDictionary();

  // Load built-in words into the dictionary
  for (const [name, word] of Object.entries(builtins)) {
    define(dictionary, name, () => word(stack));
  }
}

/**
 * Executes a Forth command.
 * @param command - The command to execute.
 * @returns The current stack state.
 * @throws {Error} If an unknown word is encountered.
 */
export function execute(command: string): number[] {
  const tokens = tokenize(command); // Tokenize the input

  for (const token of tokens) {
    if (typeof token === "number") {
      push(stack, token); // Push numbers onto the stack
    } else if (typeof token === "string") {
      const fn = find(dictionary, token); // Look up the word in the dictionary

      if (fn) {
        try {
          fn(); // Execute the word
        } catch (error) {
          const stackState = getItems(stack); // Capture the current stack state
          const errorMessage =
            error instanceof Error
              ? `Error executing word '${token}' (stack: ${JSON.stringify(
                  stackState
                )}): ${error.message}`
              : `Unknown error executing word '${token}' (stack: ${JSON.stringify(
                  stackState
                )})`;
          throw new Error(errorMessage); // Rethrow with additional context
        }
      } else {
        throw new Error(`Unknown word: ${token}`); // Throw error for unknown words
      }
    }
  }

  return getItems(stack); // Return the current stack state
}

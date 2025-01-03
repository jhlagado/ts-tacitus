import { Stack, createStack, push, pop, getItems, peek } from "./stack";
import { Dictionary, createDictionary, define, find } from "./dictionary";
import { tokenize } from "./lexer"; // Import the lexer

let stack: Stack<number> = createStack<number>();
let dictionary: Dictionary = createDictionary();

/**
 * Initializes the Forth interpreter by defining core words.
 */
export function initializeInterpreter(): void {
  stack = createStack<number>();
  dictionary = createDictionary();

  define(dictionary, "+", () => {
    const b = pop(stack);
    const a = pop(stack);
    if (a !== undefined && b !== undefined) {
      push(stack, a + b);
    }
  });

  define(dictionary, "-", () => {
    const b = pop(stack);
    const a = pop(stack);
    if (a !== undefined && b !== undefined) {
      push(stack, a - b);
    }
  });

  define(dictionary, "*", () => {
    const b = pop(stack);
    const a = pop(stack);
    if (a !== undefined && b !== undefined) {
      push(stack, a * b);
    }
  });

  define(dictionary, "/", () => {
    const b = pop(stack);
    const a = pop(stack);

    if (a === undefined || b === undefined) {
      throw new Error("Stack underflow");
    }

    if (b === 0) {
      throw new Error("Division by zero");
    }

    push(stack, a / b);
  });

  define(dictionary, "dup", () => {
    const a = peek(stack);
    if (a !== undefined) {
      push(stack, a);
    }
  });

  define(dictionary, "drop", () => {
    pop(stack);
  });

  define(dictionary, "swap", () => {
    const a = pop(stack);
    const b = pop(stack);
    if (a !== undefined && b !== undefined) {
      push(stack, a);
      push(stack, b);
    }
  });

  // Add more core words here...
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
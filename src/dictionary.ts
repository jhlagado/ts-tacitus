// src/dictionary.ts

import { Verb } from "./types";
import { ops, opTable } from "./builtins"; // Import ops and opTable

// Define the builtins object
export const builtins: Record<string, Verb> = Object.fromEntries(
  Object.entries(opTable).map(([name, index]) => [name, ops[index]])
);

export class Dictionary {
  words: Record<string, Verb>;

  constructor() {
    // Initialize the words object with the builtins
    this.words = { ...builtins };
  }

  // Define a new word in the dictionary
  define(name: string, word: Verb): void {
    this.words[name] = word;
  }

  // Find a word in the dictionary
  find(name: string): Verb | undefined {
    return this.words[name];
  }
}
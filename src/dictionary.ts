// src/dictionary.ts

import { Verb } from "./types";
import { builtins } from "./builtins"; // Import ops and opTable

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
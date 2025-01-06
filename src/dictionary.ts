import { Dictionary, Verb } from "./types";

/**
 * Creates a new dictionary.
 * @returns A new dictionary.
 */
export function createDictionary<T = Verb>(): Dictionary<T> {
  return {};
}

/**
 * Defines a new word in the dictionary.
 * @param dictionary - The dictionary to define the word in.
 * @param name - The name of the word.
 * @param word - The function that implements the word.
 */
export function define<T = Verb>(
  dictionary: Dictionary<T>,
  name: string,
  word: T
): void {
  dictionary[name] = word;
}

/**
 * Finds a word in the dictionary.
 * @param dictionary - The dictionary to search.
 * @param name - The name of the word to find.
 * @returns The function that implements the word, or undefined if the word is not found.
 */
export function find<T = Verb>(
  dictionary: Dictionary<T>,
  name: string
): T | undefined {
  return dictionary[name];
}

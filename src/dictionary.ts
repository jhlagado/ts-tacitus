export type Word = (...args: unknown[]) => void;
export type Dictionary = { [name: string]: Word };

/**
 * Creates a new dictionary.
 * @returns A new dictionary.
 */
export function createDictionary(): Dictionary {
  return {};
}

/**
 * Defines a new word in the dictionary.
 * @param dictionary - The dictionary to define the word in.
 * @param name - The name of the word.
 * @param word - The function that implements the word.
 */
export function define(dictionary: Dictionary, name: string, word: Word): void {
  dictionary[name] = word;
}

/**
 * Finds a word in the dictionary.
 * @param dictionary - The dictionary to search.
 * @param name - The name of the word to find.
 * @returns The function that implements the word, or undefined if the word is not found.
 */
export function find(dictionary: Dictionary, name: string): Word | undefined {
  return dictionary[name];
}
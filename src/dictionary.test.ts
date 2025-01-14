// src/dictionary.test.ts
import { builtins } from "./builtins";
import { Dictionary } from "./dictionary";
import { Verb } from "./types";

describe("Dictionary", () => {
  let dictionary: Dictionary;

  beforeEach(() => {
    dictionary = new Dictionary(); // Initialize a fresh Dictionary instance before each test
  });

  // Test 1: Initialization
  describe("Initialization", () => {
    it("should initialize with built-in words", () => {
      // Verify that all built-in words are present in the dictionary
      for (const [name, verb] of Object.entries(builtins)) {
        expect(dictionary.find(name)).toBe(verb);
      }
    });
  });

  // Test 2: Define new words
  describe("Define new words", () => {
    it("should define a new word and find it", () => {
      const wordName = "customWord";
      const wordAction: Verb = () => {}; // Mock verb function

      dictionary.define(wordName, wordAction);
      expect(dictionary.find(wordName)).toBe(wordAction);
    });

    it("should overwrite an existing word when redefined", () => {
      const wordName = "customWord";
      const wordAction1: Verb = () => {}; // Mock verb function
      const wordAction2: Verb = () => {}; // Another mock verb function

      dictionary.define(wordName, wordAction1);
      dictionary.define(wordName, wordAction2);

      expect(dictionary.find(wordName)).toBe(wordAction2);
    });
  });

  // Test 3: Find words
  describe("Find words", () => {
    it("should return undefined for unknown words", () => {
      expect(dictionary.find("unknownWord")).toBeUndefined();
    });

    it("should find built-in words", () => {
      for (const [name, verb] of Object.entries(builtins)) {
        expect(dictionary.find(name)).toBe(verb);
      }
    });
  });

  // Test 4: Built-in words
  describe("Built-in words", () => {
    it("should include all built-in words", () => {
      // Verify that the dictionary contains all built-in words
      const builtinNames = Object.keys(builtins);
      const dictionaryWords = Object.keys(dictionary.words); // Access private property for testing

      expect(dictionaryWords).toEqual(expect.arrayContaining(builtinNames));
    });
  });
});

import { Memory } from "../data/memory";
import { Verb } from "../types";
import { Dictionary } from "./dictionary";

describe("Dictionary", () => {
  let dictionary: Dictionary;

  beforeEach(() => {
    dictionary = new Dictionary(new Memory());
  });

  describe("Define new words", () => {
    it("should define a new word and find it", () => {
      const newWord: Verb = (vm) => vm.push(42);
      dictionary.define("newWord", newWord);
      expect(dictionary.find("newWord")).toBe(newWord);
    });

    it("should override an existing word", () => {
      const originalWord: Verb = (vm) => vm.push(1);
      const newWord: Verb = (vm) => vm.push(2);
      dictionary.define("overrideWord", originalWord);
      expect(dictionary.find("overrideWord")).toBe(originalWord);
      dictionary.define("overrideWord", newWord);
      expect(dictionary.find("overrideWord")).toBe(newWord);
    });
  });

  describe("Find words", () => {
    it("should return undefined for a non-existent word", () => {
      expect(dictionary.find("nonExistentWord")).toBeUndefined();
    });

    it("should find the most recently defined word", () => {
      const firstWord: Verb = (vm) => vm.push(1);
      const secondWord: Verb = (vm) => vm.push(2);
      dictionary.define("duplicateWord", firstWord);
      dictionary.define("duplicateWord", secondWord);
      expect(dictionary.find("duplicateWord")).toBe(secondWord);
    });
  });
});

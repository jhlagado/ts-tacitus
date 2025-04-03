import { Memory } from "./memory";
import { Verb } from "./types";
import { SymbolTable } from "./symbol-table";
import { Digest } from "./digest";
import { defineBuiltins } from "../ops/define-builtins";

describe("SymbolTable", () => {
  let symbolTable: SymbolTable;

  beforeEach(() => {
    symbolTable = new SymbolTable(new Digest(new Memory()));
    defineBuiltins(symbolTable);
  });

  describe("Define new words", () => {
    it("should define a new word and find it", () => {
      const newWord: Verb = (vm) => vm.push(42);
      symbolTable.define("newWord", newWord);
      expect(symbolTable.find("newWord")).toBe(newWord);
    });

    it("should override an existing word", () => {
      const originalWord: Verb = (vm) => vm.push(1);
      const newWord: Verb = (vm) => vm.push(2);
      symbolTable.define("overrideWord", originalWord);
      expect(symbolTable.find("overrideWord")).toBe(originalWord);
      symbolTable.define("overrideWord", newWord);
      expect(symbolTable.find("overrideWord")).toBe(newWord);
    });
  });

  describe("Find words", () => {
    it("should return undefined for a non-existent word", () => {
      expect(symbolTable.find("nonExistentWord")).toBeUndefined();
    });

    it("should find the most recently defined word", () => {
      const firstWord: Verb = (vm) => vm.push(1);
      const secondWord: Verb = (vm) => vm.push(2);
      symbolTable.define("duplicateWord", firstWord);
      symbolTable.define("duplicateWord", secondWord);
      expect(symbolTable.find("duplicateWord")).toBe(secondWord);
    });
  });
});

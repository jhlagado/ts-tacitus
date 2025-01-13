// src/parser.test.ts

import { initializeInterpreter, vm } from "./globalState";
import { parse } from "./parser";
import { opTable } from "./builtins"; // Import opTable

describe("Parser", () => {
  beforeEach(() => {
    initializeInterpreter(); // Reset the interpreter state before each test
  });

  it("should parse numbers into literalNumber and the number itself", () => {
    const tokens = [5, 3.14, -42];
    parse(tokens);
    const result = vm.compiler.getData();
    expect(result).toEqual([
      opTable["literalNumber"], // Use opTable for index
      5,
      opTable["literalNumber"], // Use opTable for index
      3.14,
      opTable["literalNumber"], // Use opTable for index
      -42,
      opTable["exitDef"], // Use opTable for index
    ]);
  });

  it("should parse known words into their corresponding indexes", () => {
    const tokens = ["+", "-", "dup"];
    parse(tokens);
    const result = vm.compiler.getData();
    expect(result).toEqual([
      opTable["+"], // Use opTable for index
      opTable["-"], // Use opTable for index
      opTable["dup"], // Use opTable for index
      opTable["exitDef"], // Use opTable for index
    ]);
  });

  it("should parse mixed tokens (numbers and words)", () => {
    const tokens = [5, "+", 3, "dup"];
    parse(tokens);
    const result = vm.compiler.getData();
    expect(result).toEqual([
      opTable["literalNumber"], // Use opTable for index
      5,
      opTable["+"], // Use opTable for index
      opTable["literalNumber"], // Use opTable for index
      3,
      opTable["dup"], // Use opTable for index
      opTable["exitDef"], // Use opTable for index
    ]);
  });

  it("should throw an error for unknown words", () => {
    const tokens = ["unknown"];
    expect(() => parse(tokens)).toThrow("Unknown word: unknown");
  });

  it("should handle empty input", () => {
    const tokens = [] as (string | number)[];
    parse(tokens);
    const result = vm.compiler.getData();
    expect(result).toEqual([opTable["exitDef"]]); // Use opTable for index
  });

  it("should handle nested compilation blocks", () => {
    const tokens = ["{", 5, "}", "{", 3, "}", "+"];
    parse(tokens);
    const result = vm.compiler.getData();
    expect(result).toEqual([
      opTable["{"], // Use opTable for index
      opTable["literalNumber"], // Use opTable for index
      5,
      opTable["}"], // Use opTable for index
      opTable["{"], // Use opTable for index
      opTable["literalNumber"], // Use opTable for index
      3,
      opTable["}"], // Use opTable for index
      opTable["+"], // Use opTable for index
      opTable["exitDef"], // Use opTable for index
    ]);
  });
});

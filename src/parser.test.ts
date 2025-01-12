import { parse } from "./parser";
import { initializeInterpreter, vm } from "./globalState";
import { builtins, exitDef, literalNumber } from "./builtins";
import { define } from "./dictionary";
import { getItems } from "./memory";

describe("Parser", () => {
  beforeEach(() => {
    // Reset the VM state before each test
    initializeInterpreter();

    // Load built-in words into the dictionary
    for (const [name, word] of Object.entries(builtins)) {
      define(vm.compiler.dictionary, name, word);
    }
  });

  // Test 1: Parse numbers
  it("should parse numbers into literalNumber and the number itself", () => {
    const tokens = [5, 3.14, -42];
    parse(tokens);
    const result = getItems(vm.buffer);
    expect(result).toEqual([
      literalNumber, //literalNumber`
      5, // Number
      literalNumber, //literalNumber`
      3.14, // Number
      literalNumber, //literalNumber`
      -42, // Number
      exitDef,
    ]);
  });

  // Test 2: Parse words
  it("should parse known words into their corresponding functions", () => {
    const tokens = ["+", "-", "dup"];
    parse(tokens);
    const result = getItems(vm.buffer);
    expect(result).toEqual([
      builtins["+"], //+`
      builtins["-"], //-`
      builtins["dup"], //dup`
      exitDef,
    ]);
  });

  // Test 3: Parse mixed tokens
  it("should parse mixed tokens (numbers and words)", () => {
    const tokens = [5, "+", 3, "dup"];
    parse(tokens);
    const result = getItems(vm.buffer);
    expect(result).toEqual([
      literalNumber, //literalNumber`
      5, // Number
      builtins["+"], //+`
      literalNumber, //literalNumber`
      3, // Number
      builtins["dup"], //dup`
      exitDef,
    ]);
  });

  // Test 4: Throw error for unknown words
  it("should throw an error for unknown words", () => {
    const tokens = ["unknown"];
    expect(() => parse(tokens)).toThrow("Unknown word: unknown");
  });

  // Test 5: Handle empty input
  it("should return an empty buffer for empty input", () => {
    const tokens = [] as (string | number)[];
    parse(tokens);
    const result = getItems(vm.buffer);
    expect(result).toEqual([exitDef]);
  });

  // Test 6: Handle nested compilation blocks
  it("should handle nested compilation blocks", () => {
    const tokens = ["{", 5, "}", "{", 3, "}", "+"];
    parse(tokens);
    const result = getItems(vm.buffer);
    expect(result).toEqual([
      builtins["{"],
      literalNumber,
      5,
      builtins["}"],
      builtins["{"],
      literalNumber,
      3,
      builtins["}"],
      builtins["+"],
      exitDef,
    ]);
  });
});

import { parse } from "./parser";
import { vm } from "./globalState";
import { builtins, literalNumber } from "./builtins";
import { define } from "./dictionary";

describe("Parser", () => {
  beforeEach(() => {
    // Reset the VM state before each test
    vm.stack = [];
    vm.dictionary = {};
    vm.compileMode = false;
    vm.compileBuffer = [];
    vm.nestingScore = 0;

    // Load built-in words into the dictionary
    for (const [name, word] of Object.entries(builtins)) {
      define(vm.dictionary, name, word);
    }
  });

  // Test 1: Parse numbers
  it("should parse numbers into literalNumber and the number itself", () => {
    const tokens = [5, 3.14, -42];
    const result = parse(tokens);
    expect(result).toEqual([
      literalNumber, // Function reference for `literalNumber`
      5, // Number
      literalNumber, // Function reference for `literalNumber`
      3.14, // Number
      literalNumber, // Function reference for `literalNumber`
      -42, // Number
    ]);
  });

  // Test 2: Parse words
  it("should parse known words into their corresponding functions", () => {
    const tokens = ["+", "-", "dup"];
    const result = parse(tokens);
    expect(result).toEqual([
      builtins["+"], // Function reference for `+`
      builtins["-"], // Function reference for `-`
      builtins["dup"], // Function reference for `dup`
    ]);
  });

  // Test 3: Parse mixed tokens
  it("should parse mixed tokens (numbers and words)", () => {
    const tokens = [5, "+", 3, "dup"];
    const result = parse(tokens);
    expect(result).toEqual([
      literalNumber, // Function reference for `literalNumber`
      5, // Number
      builtins["+"], // Function reference for `+`
      literalNumber, // Function reference for `literalNumber`
      3, // Number
      builtins["dup"], // Function reference for `dup`
    ]);
  });

  // Test 4: Throw error for unknown words
  it("should throw an error for unknown words", () => {
    const tokens = ["unknown"];
    expect(() => parse(tokens)).toThrow("Unknown word: unknown");
  });

  // Test 5: Handle empty input
  it("should return an empty buffer for empty input", () => {
    const tokens: (string | number)[] = [];
    const result = parse(tokens);
    expect(result).toEqual([]);
  });

  // Test 6: Handle nested compilation blocks
  it("should handle nested compilation blocks", () => {
    const tokens = ["{", 5, "}", "{", 3, "}", "+"];
    const result = parse(tokens);
    expect(result).toEqual([
      builtins["{"], // Function reference for `{`
      literalNumber, // Function reference for `literalNumber`
      5, // Number
      builtins["}"], // Function reference for `}`
      builtins["{"], // Function reference for `{`
      literalNumber, // Function reference for `literalNumber`
      3, // Number
      builtins["}"], // Function reference for `}`
      builtins["+"], // Function reference for `+`
    ]);
  });
});

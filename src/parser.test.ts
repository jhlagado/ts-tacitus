// src/parser.test.ts

import { initializeInterpreter, vm } from "./globalState";
import { parse } from "./parser";
import { Op } from "./builtins"; // Import opTable
import { lex } from "./lexer";

describe("Parser", () => {
  beforeEach(() => {
    initializeInterpreter(); // Reset the interpreter state before each test
    vm.debug = true;
  });

  it("should parse numbers into literalNumber and the number itself", () => {
    const tokens = [5, 3.14, -42];
    parse(tokens);
    const result = vm.compiler.getData();
    expect(result).toEqual([
      Op.LiteralNumber,
      5,
      Op.LiteralNumber, // Use opTable for index
      3.14,
      Op.LiteralNumber, // Use opTable for index
      -42,
      Op.Exit, // Use opTable for index
    ]);
  });

  it("should parse known words into their corresponding indexes", () => {
    const tokens = lex("+ - dup");
    parse(tokens);
    const result = vm.compiler.getData();
    expect(result).toEqual([
      Op.Plus, // Use opTable for index
      Op.Minus, // Use opTable for index
      Op.Dup, // Use opTable for index
      Op.Exit, // Use opTable for index
    ]);
  });

  it("should parse mixed tokens (numbers and words)", () => {
    const tokens = lex("5 3 + dup");
    parse(tokens);
    const result = vm.compiler.getData();
    expect(result).toEqual([
      Op.LiteralNumber, // Use opTable for index
      5,
      Op.LiteralNumber, // Use opTable for index
      3,
      Op.Plus, // Use opTable for index
      Op.Dup, // Use opTable for index
      Op.Exit, // Use opTable for index
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
    expect(result).toEqual([Op.Exit]); // Use opTable for index
  });

  it("should handle compilation blocks", () => {
    const tokens = lex("{ 5 } { 3 } + ");
    parse(tokens);
    const result = vm.compiler.getData();
    expect(result).toEqual([
      Op.BranchCall,
      3,
      Op.LiteralNumber, // Use opTable for index
      5,
      Op.Exit,
      Op.BranchCall,
      3,
      Op.LiteralNumber, // Use opTable for index
      3,
      Op.Exit,
      Op.Plus, // Use opTable for index
      Op.Exit, // Use opTable for index
    ]);
  });

  it("should handle nested compilation blocks", () => {
    const tokens = lex("{ { 5 } { 3 } + }");
    parse(tokens);
    const result = vm.compiler.getData();
    expect(result).toEqual([
      Op.BranchCall,
      12,
      Op.BranchCall,
      3,
      Op.LiteralNumber, // Use opTable for index
      5,
      Op.Exit,
      Op.BranchCall,
      3,
      Op.LiteralNumber, // Use opTable for index
      3,
      Op.Exit,
      Op.Plus, // Use opTable for index
      Op.Exit, // Use opTable for index
      Op.Exit, // Use opTable for index
    ]);
  });

  // Test for unknown words
  it("should throw an error for unknown words", () => {
    const tokens = ["unknown"];
    expect(() => parse(tokens)).toThrow("Unknown word: unknown");
  });
});

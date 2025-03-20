// src/core/parser.test.ts

import { initializeInterpreter, vm } from "./globalState";
import { parse } from "./parser"; // Updated path
import { Op } from "../ops/builtins";
import { Tokenizer } from "./tokenizer"; // Import Tokenizer instead of lex

describe("Parser", () => {
  beforeEach(() => {
    initializeInterpreter(); // Reset the interpreter state before each test
    // vm.debug = true;
  });

  it("should parse numbers into literalNumber and the number itself", () => {
    // Use a string with numbers instead of an array of tokens
    parse(new Tokenizer("5 3.14 -42"));

    vm.reset();
    expect(vm.next8()).toBe(Op.LiteralNumber);
    expect(vm.nextFloat()).toBeCloseTo(5);
    expect(vm.next8()).toBe(Op.LiteralNumber);
    expect(vm.nextFloat()).toBeCloseTo(3.14);
    expect(vm.next8()).toBe(Op.LiteralNumber);
    expect(vm.nextFloat()).toBeCloseTo(-42);
    expect(vm.next8()).toBe(Op.Abort);
  });

  it("should parse known words into their corresponding indexes", () => {
    parse(new Tokenizer("+ - dup"));

    vm.reset();
    expect(vm.next8()).toBe(Op.Plus);
    expect(vm.next8()).toBe(Op.Minus);
    expect(vm.next8()).toBe(Op.Dup);
    expect(vm.next8()).toBe(Op.Abort);
  });

  it("should parse mixed tokens (numbers and words)", () => {
    parse(new Tokenizer("5 3 + dup"));

    vm.reset();
    expect(vm.next8()).toBe(Op.LiteralNumber);
    expect(vm.nextFloat()).toBeCloseTo(5);
    expect(vm.next8()).toBe(Op.LiteralNumber);
    expect(vm.nextFloat()).toBeCloseTo(3);
    expect(vm.next8()).toBe(Op.Plus);
    expect(vm.next8()).toBe(Op.Dup);
    expect(vm.next8()).toBe(Op.Abort);
  });

  it("should throw an error for unknown words", () => {
    expect(() => parse(new Tokenizer("unknown"))).toThrow(
      "Unknown word: unknown"
    );
  });

  it("should handle empty input", () => {
    parse(new Tokenizer(""));

    vm.reset();
    expect(vm.next8()).toBe(Op.Abort);
  });

  it("should handle compilation blocks", () => {
    parse(new Tokenizer("(50) (30) + "));

    vm.reset();
    expect(vm.next8()).toBe(Op.BranchCall);
    expect(vm.next16()).toBe(6);
    expect(vm.next8()).toBe(Op.LiteralNumber);
    expect(vm.nextFloat()).toBeCloseTo(50);
    expect(vm.next8()).toBe(Op.Exit);
    expect(vm.next8()).toBe(Op.BranchCall);
    expect(vm.next16()).toBe(6);
    expect(vm.next8()).toBe(Op.LiteralNumber);
    expect(vm.nextFloat()).toBeCloseTo(30);
    expect(vm.next8()).toBe(Op.Exit);
    expect(vm.next8()).toBe(Op.Plus);
    expect(vm.next8()).toBe(Op.Abort);
  });

  it("should handle nested compilation blocks", () => {
    parse(new Tokenizer("((6) (3) +)"));

    vm.reset();
    expect(vm.next8()).toBe(Op.BranchCall);
    expect(vm.next16()).toBe(20);
    expect(vm.next8()).toBe(Op.BranchCall);
    expect(vm.next16()).toBe(6);
    expect(vm.next8()).toBe(Op.LiteralNumber);
    expect(vm.nextFloat()).toBeCloseTo(6);
    expect(vm.next8()).toBe(Op.Exit);
    expect(vm.next8()).toBe(Op.BranchCall);
    expect(vm.next16()).toBe(6);
    expect(vm.next8()).toBe(Op.LiteralNumber);
    expect(vm.nextFloat()).toBeCloseTo(3);
    expect(vm.next8()).toBe(Op.Exit);
    expect(vm.next8()).toBe(Op.Plus);
    expect(vm.next8()).toBe(Op.Exit);
    expect(vm.next8()).toBe(Op.Abort);
  });

  // Test for unknown words
  // it("should throw an error for unknown words", () => {
  //   const tokens = ["unknown"];
  //   expect(() => parse(tokens)).toThrow("Unknown word: unknown");
  // });
});

describe("Parser - Colon Definitions", () => {
  beforeEach(() => {
    initializeInterpreter();
    vm.debug = true;
  });

  it("should parse simple colon definition", () => {
    const code = ": square dup * ;";
    parse(new Tokenizer(code));

    // Verify symbolTable entry
    const squareWord = vm.symbolTable.find("square");
    expect(squareWord).toBeDefined();

    // Verify compiled code structure
    const compiled = vm.getCompileData();
    expect(compiled).toEqual([
      Op.Branch, // 0: BranchOp
      0x03,
      0x00, // 1-2: Skip 6 bytes (patch offset)
      Op.Dup, // 3: dup
      Op.Multiply, // 4: *
      Op.Exit, // 5: exit
      Op.Abort, // 6: main abort
    ]);
  });

  it("should reject nested definitions", () => {
    const code = ": foo : bar ; ;";
    expect(() => parse(new Tokenizer(code))).toThrow(
      "Nested definitions are not allowed"
    );
  });

  it("should validate definition names", () => {
    const code = ": 123name ;";
    parse(new Tokenizer(code));
    const compiled = vm.getCompileData();
    expect(compiled).toEqual([
      Op.Branch, // 0: BranchOp
      0x01,
      0x00, // 1-2: Skip 6 bytes (patch offset)
      Op.Exit, // 5: exit
      Op.Abort, // 6: main abort
    ]);

    expect(() => parse(new Tokenizer(": test! ;"))).not.toThrow(
      "Invalid definition name: test!"
    );
  });

  it("should detect unclosed definitions", () => {
    expect(() => parse(new Tokenizer(": foo"))).toThrow(
      "Unclosed definition for foo"
    );
  });

  it("should allow definitions containing blocks", () => {
    const code = `
      : print_sum (+) eval ; 
      3 4 print_sum
    `;
    parse(new Tokenizer(code));
    const printSum = vm.symbolTable.find("print_sum");
    expect(printSum).toBeDefined();
    const compiled = vm.getCompileData();
    expect(compiled.slice(0, 10)).toEqual([
      Op.Branch, // BranchOp
      0x07,
      0x00, // Skip 12 bytes
      Op.BranchCall, // {
      0x02,
      0x00, // Jump to +
      Op.Plus, // +
      Op.Exit, // }
      Op.Eval, // eval
      Op.Exit, // exit
    ]);
  });

  it("should handle empty definitions", () => {
    const code = ": empty ;";
    parse(new Tokenizer(code));

    const emptyWord = vm.symbolTable.find("empty");
    expect(emptyWord).toBeDefined();

    // Execute the empty word
    emptyWord!(vm);
    expect(vm.IP).toBe(vm.compiler.BP); // Should jump to exit immediately
  });

  it("should handle multiple definitions", () => {
    const code = `
      : inc 1 + ;
      : dec 1 - ;
    `;
    parse(new Tokenizer(code));

    expect(vm.symbolTable.find("inc")).toBeDefined();
    expect(vm.symbolTable.find("dec")).toBeDefined();
  });

  it("should reject definitions in code blocks", () => {
    const code = "( : bad ; )";
    expect(() => parse(new Tokenizer(code))).toThrow(
      "Cannot nest definition inside code block"
    );
  });

  it("should maintain separate compilation contexts", () => {
    parse(new Tokenizer(": test1 1 + ;"));
    const size1 = vm.compiler.CP;

    initializeInterpreter();
    parse(new Tokenizer(": test2 2 + ;"));
    const size2 = vm.compiler.CP;

    expect(size1).toEqual(size2); // Should compile to same size
    expect(vm.symbolTable.find("test1")).toBeUndefined();
    expect(vm.symbolTable.find("test2")).toBeDefined();
  });
});

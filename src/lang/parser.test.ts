// src/parser.test.ts

import { initializeInterpreter, vm } from "../core/globalState";
import { parse } from "./parser";
import { Op } from "../ops/builtins"; // Import opTable
import { lex } from "./lexer";

describe("Parser", () => {
  beforeEach(() => {
    initializeInterpreter(); // Reset the interpreter state before each test
    // vm.debug = true;
  });

  it("should parse numbers into literalNumber and the number itself", () => {
    const tokens = [5, 3.14, -42];
    parse(tokens);
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
    const tokens = lex("+ - dup");
    parse(tokens);
    vm.reset();
    expect(vm.next8()).toBe(Op.Plus);
    expect(vm.next8()).toBe(Op.Minus);
    expect(vm.next8()).toBe(Op.Dup);
    expect(vm.next8()).toBe(Op.Abort);
  });

  it("should parse mixed tokens (numbers and words)", () => {
    const tokens = lex("5 3 + dup");
    parse(tokens);
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
    const tokens = ["unknown"];
    expect(() => parse(tokens)).toThrow("Unknown word: unknown");
  });

  it("should handle empty input", () => {
    const tokens = [] as (string | number)[];
    parse(tokens);
    vm.reset();
    expect(vm.next8()).toBe(Op.Abort);
  });

  it("should handle compilation blocks", () => {
    const tokens = lex("{ 50 } { 30 } + ");
    parse(tokens);
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
    const tokens = lex("{ { 6 } { 3 } + }");
    parse(tokens);
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
  it("should throw an error for unknown words", () => {
    const tokens = ["unknown"];
    expect(() => parse(tokens)).toThrow("Unknown word: unknown");
  });
});

describe("Parser - Colon Definitions", () => {
  beforeEach(() => {
    initializeInterpreter();
    vm.debug = true;
  });

  it("should parse simple colon definition", () => {
    const code = ": square dup * ;";
    const tokens = lex(code);
    parse(tokens);

    // Verify dictionary entry
    const squareWord = vm.dictionary.find("square");
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
    expect(() => parse(lex(code))).toThrow(
      "Nested definitions are not allowed"
    );
  });

  it("should validate definition names", () => {
    const code = ": 123name ;";
    const tokens = lex(code);
    parse(tokens);
    const compiled = vm.getCompileData();
    expect(compiled).toEqual([
      Op.Branch, // 0: BranchOp
      0x01,
      0x00, // 1-2: Skip 6 bytes (patch offset)
      Op.Exit, // 5: exit
      Op.Abort, // 6: main abort
    ]);

    expect(() => parse(lex(": test! ;"))).not.toThrow(
      "Invalid definition name: test!"
    );
  });

  it("should detect unclosed definitions", () => {
    expect(() => parse(lex(": foo"))).toThrow("Unclosed definition for foo");
  });

  it("should allow definitions containing blocks", () => {
    const code = `
      : print_sum { + } eval ; 
      3 4 print_sum
    `;
    parse(lex(code));
    const printSum = vm.dictionary.find("print_sum");
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
    parse(lex(code));

    const emptyWord = vm.dictionary.find("empty");
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
    parse(lex(code));

    expect(vm.dictionary.find("inc")).toBeDefined();
    expect(vm.dictionary.find("dec")).toBeDefined();
  });

  it("should reject definitions in code blocks", () => {
    const code = "{ : bad ; }";
    expect(() => parse(lex(code))).toThrow(
      "Cannot nest definition inside code block"
    );
  });

  it("should maintain separate compilation contexts", () => {
    parse(lex(": test1 1 + ;"));
    const size1 = vm.compiler.CP;

    initializeInterpreter();
    parse(lex(": test2 2 + ;"));
    const size2 = vm.compiler.CP;

    expect(size1).toEqual(size2); // Should compile to same size
    expect(vm.dictionary.find("test1")).toBeUndefined();
    expect(vm.dictionary.find("test2")).toBeDefined();
  });
});

// src/parser.test.ts

import { initializeInterpreter, vm } from "./globalState";
import { parse } from "./parser";
import { Op } from "./builtins"; // Import opTable
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
    expect(vm.nextInteger()).toBe(9);
    expect(vm.next8()).toBe(Op.LiteralNumber);
    expect(vm.nextFloat()).toBeCloseTo(50);
    expect(vm.next8()).toBe(Op.Exit);
    expect(vm.next8()).toBe(Op.BranchCall);
    expect(vm.nextInteger()).toBe(9);
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
    expect(vm.nextInteger()).toBe(27);
    expect(vm.next8()).toBe(Op.BranchCall);
    expect(vm.nextInteger()).toBe(9);
    expect(vm.next8()).toBe(Op.LiteralNumber);
    expect(vm.nextFloat()).toBeCloseTo(6);
    expect(vm.next8()).toBe(Op.Exit);
    expect(vm.next8()).toBe(Op.BranchCall);
    expect(vm.nextInteger()).toBe(9);
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

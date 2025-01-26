// src/parser.test.ts
import { initializeInterpreter, vm } from "./globalState";
import { parse } from "./parser";
import { lex } from "./lexer";
import { Op } from "./builtins";

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

  xit("should validate definition names", () => {
    expect(() => parse(lex(": 123bad-name ;"))).toThrow(
      "Invalid definition name: 123"
    );
    expect(() => parse(lex(": test! ;"))).toThrow(
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
      "Cannot nest defintion inside code block"
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

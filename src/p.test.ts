// src/parser.test.ts
import { initializeInterpreter, vm } from "./globalState";
import { parse } from "./parser";
import { lex } from "./lexer";
import { Op } from "./builtins";

describe("Parser - Colon Definitions", () => {
  beforeEach(() => {
    initializeInterpreter();
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
      Op.BranchOp,        // 0: BranchOp
      0x03, 0x00,         // 1-2: Skip 6 bytes (patch offset)
      Op.Dup,             // 3: dup
      Op.Multiply,        // 4: *
      Op.Exit,            // 5: exit
      Op.Abort            // 6: main abort
    ]);
  });

  it("should reject nested definitions", () => {
    const code = ": foo : bar ; ;";
    expect(() => parse(lex(code))).toThrow("Nested definitions are not allowed");
  });

  xit("should validate definition names", () => {
    expect(() => parse(lex(": 123bad-name ;"))).toThrow("Invalid definition name: 123");
    expect(() => parse(lex(": test! ;"))).toThrow("Invalid definition name: test!");
  });

  it("should detect unclosed definitions", () => {
    expect(() => parse(lex(": foo"))).toThrow("Unclosed definition for foo");
  });

  xit("should skip definition body during normal execution", () => {
    const code = `
      : double 2 * ;
      5 double
    `;
    parse(lex(code));
    vm.IP = vm.compiler.BP;
    vm.running = true;
    
    // Execute the code
    while(vm.running) {
      const opcode = vm.next8();
      if (opcode === Op.Abort) break;
      // Normally you'd execute the opcode here
    }
    
    // Verify stack contains 10 (5*2)
    expect(vm.getStackData()).toEqual([10]);
  });

  xit("should allow definitions containing blocks", () => {
    const code = `
      : print-sum { + } eval ;
      3 4 print-sum
    `;
    parse(lex(code));
    
    // Verify dictionary entry
    const printSum = vm.dictionary.find("print-sum");
    expect(printSum).toBeDefined();
    
    // Verify compiled code structure
    const compiled = vm.getCompileData();
    expect(compiled.slice(0, 10)).toEqual([
      Op.BranchOp,        // BranchOp
      0x00, 0x0C,         // Skip 12 bytes
      Op.BranchCall,       // {
      0x00, 0x05,         // Jump to +
      Op.Plus,            // +
      Op.Exit,            // } 
      Op.Eval,            // eval
      Op.Exit,            // exit
      Op.Abort            // main abort
    ]);
  });

  xit("should handle empty definitions", () => {
    const code = ": empty ;";
    parse(lex(code));
    
    const emptyWord = vm.dictionary.find("empty");
    expect(emptyWord).toBeDefined();
    
    // Execute the empty word
    emptyWord!(vm);
    expect(vm.IP).toBe(vm.compiler.BP + 5); // Should jump to exit immediately
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

  xit("should reject definitions in code blocks", () => {
    const code = "{ : bad ; }";
    expect(() => parse(lex(code))).toThrow("Nested definitions are not allowed");
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
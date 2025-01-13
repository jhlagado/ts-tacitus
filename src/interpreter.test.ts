// src/interpreter.test.ts
import { execute } from "./interpreter";
import { parse } from "./parser";
import { lex } from "./lexer";
import { vm, initializeInterpreter } from "./globalState";
import { Op } from "./builtins"; // Import Op enum
import { TIB } from "./constants";

describe("Interpreter", () => {
  beforeEach(() => {
    initializeInterpreter();
  });

  it("should compile a block and push it onto the stack", () => {
    const tokens = lex("{ 5 3 + }");
    parse(tokens);
    execute(TIB);
    // const tos = vm.pop();
    // expect(tos).toBe(CODE);
    const received = vm.compiler.getCodeData();
    expect(received).toEqual([
      Op.LiteralNumber, // Use Op enum
      5,
      Op.LiteralNumber, // Use Op enum
      3,
      Op.PlusOp, // Use Op enum
      Op.ExitDef, // Use Op enum
    ]);
  });

  it("should execute a simple addition", () => {
    const tokens = lex("5 3 +");
    parse(tokens);
    execute(TIB);
    const received = vm.getStackData();
    expect(received).toEqual([8]);
  });

  it("should handle the 'dup' word", () => {
    const tokens = lex("5 dup");
    parse(tokens);
    execute(TIB);
    const received = vm.getStackData();
    expect(received).toEqual([5, 5]);
  });

  it("should handle empty commands", () => {
    const tokens = lex("");
    parse(tokens);
    execute(TIB);
    const received = vm.getStackData();
    expect(received).toEqual([]);
  });

  it("should execute multiple operations", () => {
    const tokens = lex("5 3 + 2 *");
    parse(tokens);
    execute(TIB);
    const received = vm.getStackData();
    expect(received).toEqual([16]);
  });

  it("should handle immediate words during compilation", () => {
    const tokens = lex("{ 5 }");
    parse(tokens);
    execute(TIB);
    // const tos = vm.pop();
    // expect(tos).toBe(CODE);
    const received = vm.compiler.getCodeData();
    expect(received).toEqual([
      Op.LiteralNumber, // Use Op enum
      5,
      Op.ExitDef, // Use Op enum
    ]);
  });

  it("should throw an error for unknown verb indexes", () => {
    vm.compiler.resetBuffer();
    vm.compiler.compileBuffer(999); // Invalid verb index
    vm.running = true;
    expect(() => execute(TIB)).toThrowError("Invalid opcode: 999");
  });
});

import { execute } from "./interpreter";
import { parse } from "./parser";
import { lex } from "./lexer";
import { vm, initializeInterpreter } from "./globalState";
import { Op } from "./builtins"; // Import Op enum
import { BUFFER, CODE } from "./constants";

describe("Interpreter", () => {
  beforeEach(() => {
    initializeInterpreter();
  });

  it("should compile a block and push it onto the stack", () => {
    const tokens = lex("{ 5 3 + }");
    parse(tokens);
    execute(BUFFER);
    const received = vm.compiler.getData();
    expect(received).toEqual([
      Op.Branch,
      CODE + 8,
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
    execute(BUFFER);
    const received = vm.getStackData();
    expect(received).toEqual([8]);
  });

  it("should handle the 'dup' word", () => {
    const tokens = lex("5 dup");
    parse(tokens);
    execute(BUFFER);
    const received = vm.getStackData();
    expect(received).toEqual([5, 5]);
  });

  it("should handle empty commands", () => {
    const tokens = lex("");
    parse(tokens);
    execute(BUFFER);
    const received = vm.getStackData();
    expect(received).toEqual([]);
  });

  it("should execute multiple operations", () => {
    const tokens = lex("5 3 + 2 *");
    parse(tokens);
    execute(BUFFER);
    const received = vm.getStackData();
    expect(received).toEqual([16]);
  });

  it("should handle immediate words during compilation", () => {
    const tokens = lex("{ 5 }");
    parse(tokens);
    execute(BUFFER);
    const received = vm.compiler.getData();
    expect(received).toEqual([
      Op.Branch,
      CODE + 5,
      Op.LiteralNumber, // Use Op enum
      5,
      Op.ExitDef, // Use Op enum
    ]);
  });

  // New test: Verb throws an Error object
  it("should handle errors thrown by verbs", () => {
    const tokens = lex("5 0 /"); // Division by zero
    parse(tokens);
    expect(() => execute(BUFFER)).toThrowError(
      /Unknown error executing word \(stack: .*\): Division by zero/
    );
  });

  // New test: Include stack state in error messages
  it("should include the stack state in error messages", () => {
    const tokens = lex("5 0 /"); // Division by zero
    parse(tokens);
    try {
      execute(BUFFER);
    } catch (error) {
      if (error instanceof Error) {
        expect(error.message).toMatch(
          /Unknown error executing word \(stack: .*\): Division by zero/
        );
      } else {
        fail("Expected an Error object");
      }
    }
  });
});

import { execute } from "./interpreter";
import { parse } from "./parser";
import { lex } from "./lexer";
import { vm, initializeInterpreter } from "./globalState";

describe("Interpreter", () => {
  beforeEach(() => {
    initializeInterpreter();
  });

  it("should execute a simple addition", () => {
    const tokens = lex("5 3 +");
    parse(tokens);
    execute(vm.compiler.BP);
    const received = vm.getStackData();
    expect(received).toEqual([8]);
  });

  it("should handle the 'dup' word", () => {
    const tokens = lex("5 dup");
    parse(tokens);
    execute(vm.compiler.BP);
    const received = vm.getStackData();
    expect(received).toEqual([5, 5]);
  });

  it("should handle empty commands", () => {
    const tokens = lex("");
    parse(tokens);
    execute(vm.compiler.BP);
    const received = vm.getStackData();
    expect(received).toEqual([]);
  });

  it("should execute multiple operations", () => {
    const tokens = lex("5 3 + 2 *");
    parse(tokens);
    execute(vm.compiler.BP);
    const received = vm.getStackData();
    expect(received).toEqual([16]);
  });

  // New test: Verb throws an Error object
  it("should handle errors thrown by verbs", () => {
    const tokens = lex("5 0 /"); // Division by zero
    parse(tokens);
    expect(() => execute(vm.compiler.BP)).toThrowError(
      "Error executing word (stack: []): Division by zero (stack: [])"
    );
  });

  // New test: Include stack state in error messages
  it("should include the stack state in error messages", () => {
    const tokens = lex("5 0 /"); // Division by zero
    parse(tokens);
    try {
      execute(vm.compiler.BP);
    } catch (error) {
      if (error instanceof Error) {
        expect(error.message).toBe(
          "Error executing word (stack: []): Division by zero (stack: [])"
        );
      } else {
        fail("Expected an Error object");
      }
    }
  });

  // Test for invalid opcode
  it("should throw an error for invalid opcode", () => {
    vm.compiler.compile(999); // Invalid opcode
    expect(() => execute(vm.compiler.BP)).toThrow("Invalid opcode: 999");
  });

  it("should execute code block", () => {
    const tokens = lex("{3 2*}eval");
    parse(tokens);
    execute(vm.compiler.BP);
    const received = vm.getStackData();
    expect(received).toEqual([6]);
  });

  it("should execute more complex code block", () => {
    const tokens = lex("4{3 2*}eval+");
    parse(tokens);
    execute(vm.compiler.BP);
    const received = vm.getStackData();
    expect(received).toEqual([10]);
  });

  it("should execute more complex nested code block", () => {
    const tokens = lex("{{4 2+}eval{3 2+}eval*}eval 2+");
    parse(tokens);
    execute(vm.compiler.BP);
    const received = vm.getStackData();
    expect(received).toEqual([32]);
  });
});

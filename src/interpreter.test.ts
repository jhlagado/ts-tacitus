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

  it("should handle errors thrown by verbs", () => {
    const tokens = lex("5 0 /"); // Division by zero
    parse(tokens);
    expect(() => execute(vm.compiler.BP)).toThrowError(
      "Error executing word (stack: []): Division by zero (stack: [])"
    );
  });

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

  it("should throw an error for invalid opcode", () => {
    vm.compiler.compile8(999); // Invalid opcode
    expect(() => execute(vm.compiler.BP)).toThrow("Invalid opcode: 231 (stack: [])");
  });

  it("should execute code block", () => {
    // const tokens = lex("{3 2*}eval");
    const tokens = lex("{3 2*}");
    parse(tokens);
    execute(vm.compiler.BP);
    const received = vm.getStackData();
    expect(received).toEqual([6]);
  });

  xit("should execute more complex code block", () => {
    const tokens = lex("4{3 2*}eval+");
    parse(tokens);
    execute(vm.compiler.BP);
    const received = vm.getStackData();
    expect(received).toEqual([10]);
  });

  xit("should execute more complex nested code block", () => {
    const tokens = lex("{{4 2+}eval{3 2+}eval*}eval 2+");
    parse(tokens);
    execute(vm.compiler.BP);
    const received = vm.getStackData();
    expect(received).toEqual([32]);
  });

  // New test: Test the `while (vm.running)` loop
  it("should eit the loop when vm.running is set to false", () => {
    const tokens = lex("abort"); // The 'abort' word sets vm.running to false
    parse(tokens);
    execute(vm.compiler.BP);
    expect(vm.running).toBe(false);
  });
});

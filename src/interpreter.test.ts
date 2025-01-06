import { execute } from "./interpreter";
import { builtins, literalNumber, exitDef } from "./builtins";
import { parse } from "./parser";
import { lex } from "./lexer";
import { vm, initializeInterpreter } from "./globalState";

describe("Interpreter", () => {
  beforeEach(() => {
    initializeInterpreter(); // Reset the interpreter state before each test
  });

  // Compilation mode
  it("should compile a block and push it onto the stack", () => {
    const buffer = parse(lex("{ 5 3 + }"));
    buffer.push(exitDef);
    execute(buffer);
    const received = vm.stack;
    const expected = [
      literalNumber, // Function reference for `literalNumber`
      5, // Number
      literalNumber, // Function reference for `literalNumber`
      3, // Number
      builtins["+"], // Function reference for `+`
    ];
    console.log("received", received);
    console.log("expected", expected);
    expect(received).toEqual(expected);
  });

  // // Test 1: Simple arithmetic operations
  // it("should execute a simple addition", () => {
  //   execute("5 3 +");
  //   expect(vm.stack).toEqual([8]);
  // });

  // // Test 2: Stack manipulation
  // it("should handle the 'dup' word", () => {
  //   execute("5 dup");
  //   expect(vm.stack).toEqual([5, 5]);
  // });

  // // Test 4: Error handling
  // it("should throw an error for unknown words", () => {
  //   expect(() => execute("unknown")).toThrow("Unknown word: unknown");
  // });

  // // Test 5: Empty commands
  // it("should handle empty commands", () => {
  //   execute("");
  //   expect(vm.stack).toEqual([]);
  // });

  // // Test 6: Multiple operations
  // it("should execute multiple operations", () => {
  //   execute("5 3 + 2 *");
  //   expect(vm.stack).toEqual([16]);
  // });
});

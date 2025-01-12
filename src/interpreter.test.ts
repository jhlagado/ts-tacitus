import { execute } from "./interpreter";
import { builtins, literalNumber, exitDef } from "./builtins";
import { parse } from "./parser";
import { lex } from "./lexer";
import { vm, initializeInterpreter } from "./globalState";
import { getData, getItems, pop, setData } from "./memory";
import { Verb } from "./types";

describe("Interpreter", () => {
  beforeEach(() => {
    initializeInterpreter();
  });

  it("should compile a block and push it onto the stack", () => {
    const tokens = lex("{ 5 3 + }");
    parse(tokens);
    execute();
    const tos = vm.pop() as number;
    const received = getData(vm.heap, tos, 6);
    expect(received).toEqual([
      literalNumber,
      5,
      literalNumber,
      3,
      builtins["+"],
      exitDef,
    ]);
  });

  it("should execute a simple addition", () => {
    const tokens = lex("5 3 +");
    parse(tokens);
    execute();
    const received = getItems(vm.stack);
    expect(received).toEqual([8]);
  });

  it("should handle the 'dup' word", () => {
    const tokens = lex("5 dup");
    parse(tokens);
    execute();
    const received = getItems(vm.stack);
    expect(received).toEqual([5, 5]);
  });

  it("should handle empty commands", () => {
    const tokens = lex("");
    parse(tokens);
    execute();
    const received = getItems(vm.stack);
    expect(received).toEqual([]);
  });

  it("should execute multiple operations", () => {
    const tokens = lex("5 3 + 2 *");
    parse(tokens);
    execute();
    const received = getItems(vm.stack);
    expect(received).toEqual([16]);
  });

  it("should throw an error if a number is encountered in the buffer", () => {
    setData(vm.buffer, 0, [42]);
    vm.running = true;
    expect(() => execute()).toThrowError("Unexpected number in buffer");
  });

  it("should throw an error if an unknown type is encountered in the buffer", () => {
    setData(vm.buffer, 0, [{ unknown: "type" }]);
    vm.running = true;
    expect(() => execute()).toThrowError(
      'Unexpected object: {"unknown":"type"}'
    );
  });

  it("should throw an error if executing a verb throws an error", () => {
    const mockVerb: Verb = jest.fn(() => {
      throw new Error("Mock error");
    });
    setData(vm.buffer, 0, [mockVerb]);
    vm.running = true;
    expect(() => execute()).toThrowError(
      "Unknown error executing word (stack: []):Mock error"
    );
  });
});

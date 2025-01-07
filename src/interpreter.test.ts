import { execute } from "./interpreter";
import { builtins, literalNumber, exitDef } from "./builtins";
import { parse } from "./parser";
import { lex } from "./lexer";
import { vm, initializeInterpreter } from "./globalState";
import { getData, getItems, pop } from "./memory";

describe("Interpreter", () => {
  beforeEach(() => {
    initializeInterpreter();
  });

  it("should compile a block and push it onto the stack", () => {
    const tokens = lex("{ 5 3 + }");
    parse(tokens);
    execute();
    const tos = pop(vm.stack) as number;
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
});

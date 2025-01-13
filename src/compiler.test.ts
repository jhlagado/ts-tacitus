// src/compiler.test.ts
import { initializeInterpreter, vm } from "./globalState";
import { Op } from "./builtins"; // Import Op enum

describe("Compiler", () => {
  beforeEach(() => {
    initializeInterpreter(); // Reset the interpreter state before each test
  });

  it("should compile a literal number", () => {
    vm.compiler.compile(Op.LiteralNumber); // Use Op enum
    vm.compiler.compile(42);
    const received = vm.compiler.getData();
    expect(received).toEqual([
      Op.LiteralNumber, // Use Op enum
      42,
    ]);
  });

  it("should compile a built-in word", () => {
    vm.compiler.compile(Op.PlusOp); // Use Op enum
    const received = vm.compiler.getData();
    expect(received).toEqual([
      Op.PlusOp, // Use Op enum
    ]);
  });
});

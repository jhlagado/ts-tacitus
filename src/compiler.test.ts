// src/compiler.test.ts
import { initializeInterpreter, vm } from "./globalState";
import { Op } from "./builtins"; // Import Op enum

describe("Compiler", () => {
  beforeEach(() => {
    initializeInterpreter(); // Reset the interpreter state before each test
  });

  it("should compile a literal number", () => {
    vm.compiler.compileCode(Op.LiteralNumber); // Use Op enum
    vm.compiler.compileCode(42);
    const received = vm.compiler.getCodeData();
    expect(received).toEqual([
      Op.LiteralNumber, // Use Op enum
      42,
    ]);
  });

  it("should compile a built-in word", () => {
    vm.compiler.compileCode(Op.PlusOp); // Use Op enum
    const received = vm.compiler.getCodeData();
    expect(received).toEqual([
      Op.PlusOp, // Use Op enum
    ]);
  });
});

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
    vm.compiler.compile(Op.Plus); // Use Op enum
    const received = vm.compiler.getData();
    expect(received).toEqual([
      Op.Plus, // Use Op enum
    ]);
  });

  it("should preserve compiled code when preserve is true", () => {
    vm.compiler.preserve = true;
    vm.compiler.compile(42); // Compile a value
    vm.compiler.reset(); // Reset with preserve flag
    expect(vm.compiler.BP).toBe(vm.compiler.CP); // BP should move to CP
  });
});

// src/compiler.test.ts
import { initializeInterpreter, vm } from "./globalState";
import { Op } from "./builtins"; // Import Op enum

describe("Compiler", () => {
  beforeEach(() => {
    initializeInterpreter(); // Reset the interpreter state before each test
  });

  it("should compile a literal number", () => {
    vm.compiler.compile8(Op.LiteralNumber); // Use Op enum
    vm.compiler.compileFloat(42);
    vm.reset();
    expect(vm.next8()).toBe(Op.LiteralNumber);
    expect(vm.nextFloat()).toBeCloseTo(42);
  });

  it("should compile a built-in word", () => {
    vm.compiler.compile8(Op.Plus); // Use Op enum
    vm.reset();
    expect(vm.next8()).toBe(Op.Plus); // Use next8 for opcodes
  });

  it("should preserve compiled code when preserve is true", () => {
    vm.compiler.preserve = true;
    vm.compiler.compileFloat(42); // Compile a value
    vm.compiler.reset(); // Reset with preserve flag
    expect(vm.compiler.BP).toBe(vm.compiler.CP); // BP should move to CP
  });
});

// src/builtins.test.ts
import { initializeInterpreter, vm } from "./globalState";
import { ops, Op } from "./builtins"; // Import Op enum
import { CODE } from "./constants";
import { execute } from "./interpreter";

describe("Built-in Words", () => {
  beforeEach(() => {
    initializeInterpreter(); // Reset the interpreter state before each test
  });

  // Test 1: Arithmetic operations
  it("should handle the '+' word", () => {
    vm.push(5);
    vm.push(3);
    ops[Op.Plus](vm); // Use Op enum
    const received = vm.getStackData();
    expect(received).toEqual([8]);
  });

  it("should throw an error for '+' with insufficient stack items", () => {
    vm.push(5);
    expect(() => ops[Op.Plus](vm)).toThrow("Stack underflow");
  });

  it("should handle the '-' word", () => {
    vm.push(5);
    vm.push(3);
    ops[Op.Minus](vm); // Use Op enum
    expect(vm.getStackData()).toEqual([2]);
  });

  it("should throw an error for '-' with insufficient stack items", () => {
    vm.push(5);
    expect(() => ops[Op.Minus](vm)).toThrow("Stack underflow");
  });

  it("should handle the '*' word", () => {
    vm.push(5);
    vm.push(3);
    ops[Op.Multiply](vm); // Use Op enum
    expect(vm.getStackData()).toEqual([15]);
  });

  it("should throw an error for '*' with insufficient stack items", () => {
    vm.push(5);
    expect(() => ops[Op.Multiply](vm)).toThrow("Stack underflow");
  });

  it("should handle the '/' word", () => {
    vm.push(6);
    vm.push(3);
    ops[Op.Divide](vm); // Use Op enum
    expect(vm.getStackData()).toEqual([2]);
  });

  it("should throw an error for '/' with insufficient stack items", () => {
    vm.push(5);
    expect(() => ops[Op.Divide](vm)).toThrow("Stack underflow");
  });

  it("should throw an error for division by zero", () => {
    vm.push(5);
    vm.push(0);
    expect(() => ops[Op.Divide](vm)).toThrow("Division by zero");
  });

  // Test 2: Stack manipulation
  it("should handle the 'dup' word", () => {
    vm.push(5);
    ops[Op.Dup](vm); // Use Op enum
    expect(vm.getStackData()).toEqual([5, 5]);
  });

  it("should throw an error for 'dup' with an empty stack", () => {
    expect(() => ops[Op.Dup](vm)).toThrow("Stack underflow");
  });

  it("should handle the 'drop' word", () => {
    vm.push(5);
    ops[Op.Drop](vm); // Use Op enum
    expect(vm.getStackData()).toEqual([]);
  });

  it("should throw an error for 'drop' with an empty stack", () => {
    expect(() => ops[Op.Drop](vm)).toThrow("Stack underflow");
  });

  it("should handle the 'swap' word", () => {
    vm.push(5);
    vm.push(3);
    ops[Op.Swap](vm); // Use Op enum
    expect(vm.getStackData()).toEqual([3, 5]);
  });

  it("should throw an error for 'swap' with insufficient stack items", () => {
    vm.push(5);
    expect(() => ops[Op.Swap](vm)).toThrow("Stack underflow");
  });

  describe("Branch with Relative Jumps", () => {
    it("should handle a forward branch", () => {
      // Compile: branch +2 (skip the next instruction)
      vm.compiler.compile(Op.BranchCall);
      vm.compiler.compile(2); // Relative offset
      vm.compiler.compile(Op.LiteralNumber);
      vm.compiler.compile(42); // This should be skipped
      vm.compiler.compile(Op.LiteralNumber);
      vm.compiler.compile(100); // This should be executed
      vm.compiler.compile(Op.Exit);
      execute(CODE);
      expect(vm.getStackData()).toEqual([CODE + 2, 100]);
    });

    it("should handle a backward branch", () => {
      // Compile: branch -3 (jump back to the start)
      vm.compiler.compile(Op.LiteralNumber);
      vm.compiler.compile(42);
      vm.compiler.compile(Op.Exit);
      vm.compiler.compile(Op.BranchCall);
      vm.compiler.compile(-5); // Relative offset
      execute(CODE + 3);
      expect(vm.getStackData()).toEqual([CODE + 5, 42]); // Infinite loop, but we exit after two iterations
    });

    it("should handle a branch offset of 0", () => {
      // Compile: branch 0 (no jump)
      vm.compiler.compile(Op.BranchCall);
      vm.compiler.compile(0); // Relative offset
      vm.compiler.compile(Op.LiteralNumber);
      vm.compiler.compile(42);
      vm.compiler.compile(Op.Exit);

      execute(CODE);
      expect(vm.getStackData()).toEqual([CODE + 2, 42]);
    });

  });
});

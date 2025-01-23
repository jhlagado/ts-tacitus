// src/builtins.test.ts
import { initializeInterpreter, vm } from "./globalState";
import {
  divideOp,
  dropOp,
  dupOp,
  minusOp,
  multiplyOp,
  Op,
  plusOp,
  swapOp,
} from "./builtins"; // Import Op enum
import { CODE } from "./memory";
import { execute } from "./interpreter";
import { toTaggedPtr, TAG } from "./tagged-ptr";

describe("Built-in Words", () => {
  beforeEach(() => {
    initializeInterpreter(); // Reset the interpreter state before each test
  });

  it("should handle the '+' word", () => {
    vm.push(5);
    vm.push(3);
    plusOp(vm); // Use Op enum
    const received = vm.getStackData();
    expect(received).toEqual([8]);
  });

  it("should throw an error for '+' with insufficient stack items", () => {
    vm.push(5);
    expect(() => plusOp(vm)).toThrow("Stack underflow");
  });

  it("should handle the '-' word", () => {
    vm.push(5);
    vm.push(3);
    minusOp(vm); // Use Op enum
    expect(vm.getStackData()).toEqual([2]);
  });

  it("should throw an error for '-' with insufficient stack items", () => {
    vm.push(5);
    expect(() => minusOp(vm)).toThrow("Stack underflow");
  });

  it("should handle the '*' word", () => {
    vm.push(5);
    vm.push(3);
    multiplyOp(vm); // Use Op enum
    expect(vm.getStackData()).toEqual([15]);
  });

  it("should throw an error for '*' with insufficient stack items", () => {
    vm.push(5);
    expect(() => multiplyOp(vm)).toThrow("Stack underflow");
  });

  it("should handle the '/' word", () => {
    vm.push(6);
    vm.push(3);
    divideOp(vm); // Use Op enum
    expect(vm.getStackData()).toEqual([2]);
  });

  it("should throw an error for '/' with insufficient stack items", () => {
    vm.push(5);
    expect(() => divideOp(vm)).toThrow("Stack underflow");
  });

  it("should handle the 'dup' word", () => {
    vm.push(5);
    dupOp(vm); // Use Op enum
    expect(vm.getStackData()).toEqual([5, 5]);
  });

  it("should throw an error for 'dup' with an empty stack", () => {
    expect(() => dupOp(vm)).toThrow("Stack underflow");
  });

  it("should handle the 'drop' word", () => {
    vm.push(5);
    dropOp(vm); // Use Op enum
    expect(vm.getStackData()).toEqual([]);
  });

  it("should throw an error for 'drop' with an empty stack", () => {
    expect(() => dropOp(vm)).toThrow("Stack underflow");
  });

  it("should handle the 'swap' word", () => {
    vm.push(5);
    vm.push(3);
    swapOp(vm); // Use Op enum
    expect(vm.getStackData()).toEqual([3, 5]);
  });

  it("should throw an error for 'swap' with insufficient stack items", () => {
    vm.push(5);
    expect(() => swapOp(vm)).toThrow("Stack underflow");
  });

  describe("Branch with Relative Jumps", () => {
    it("should handle a forward branch", () => {
      // Compile: branch +2 (skip the next instruction)
      vm.compiler.compile8(Op.BranchCall);
      vm.compiler.compile16(5); // Relative offset
      vm.compiler.compile8(Op.LiteralNumber);
      vm.compiler.compileFloat(42); // This should be skipped
      vm.compiler.compile8(Op.LiteralNumber);
      vm.compiler.compileFloat(100); // This should be executed
      vm.compiler.compile8(Op.Abort);
      execute(CODE);
      expect(vm.getStackData()).toEqual([
        toTaggedPtr(TAG.ADDRESS, CODE + 3),
        100,
      ]);
    });

    it("should handle a backward branch", () => {
      // Compile: branch -3 (jump back to the start)
      vm.compiler.compile8(Op.LiteralNumber);
      vm.compiler.compileFloat(42);
      vm.compiler.compile8(Op.Abort);
      vm.compiler.compile8(Op.BranchCall);
      vm.compiler.compile16(-9); // Relative offset
      execute(CODE + 6);
      expect(vm.getStackData()).toEqual([
        toTaggedPtr(TAG.ADDRESS, CODE + 9),
        42,
      ]); // Infinite loop, but we exit after two iterations
    });

    it("should handle a branch offset of 0", () => {
      // Compile: branch 0 (no jump)
      vm.compiler.compile8(Op.BranchCall);
      vm.compiler.compile16(0); // Relative offset
      vm.compiler.compile8(Op.LiteralNumber);
      vm.compiler.compileFloat(42);
      vm.compiler.compile8(Op.Abort);
      execute(CODE);
      expect(vm.getStackData()).toEqual([
        toTaggedPtr(TAG.ADDRESS, CODE + 3),
        42,
      ]);
    });

    // Test for dupOp with an empty stack
    it("should throw an error for dupOp with an empty stack", () => {
      expect(() => dupOp(vm)).toThrow("Stack underflow");
    });

    // Test for swapOp with insufficient stack items
    it("should throw an error for swapOp with insufficient stack items", () => {
      vm.push(5); // Only one item on the stack
      expect(() => swapOp(vm)).toThrow("Stack underflow");
    });
  });
});

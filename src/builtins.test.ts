// src/builtins.test.ts
import { initializeInterpreter, vm } from "./globalState";
import { ops, Op, immediateWords } from "./builtins"; // Import Op enum

describe("Built-in Words", () => {
  beforeEach(() => {
    initializeInterpreter(); // Reset the interpreter state before each test
  });

  // Test 1: Arithmetic operations
  it("should handle the '+' word", () => {
    vm.push(5);
    vm.push(3);
    ops[Op.PlusOp](vm); // Use Op enum
    const received = vm.getStackData();
    expect(received).toEqual([8]);
  });

  it("should throw an error for '+' with insufficient stack items", () => {
    vm.push(5);
    expect(() => ops[Op.PlusOp](vm)).toThrow("Stack underflow");
  });

  it("should handle the '-' word", () => {
    vm.push(5);
    vm.push(3);
    ops[Op.MinusOp](vm); // Use Op enum
    expect(vm.getStackData()).toEqual([2]);
  });

  it("should throw an error for '-' with insufficient stack items", () => {
    vm.push(5);
    expect(() => ops[Op.MinusOp](vm)).toThrow("Stack underflow");
  });

  it("should handle the '*' word", () => {
    vm.push(5);
    vm.push(3);
    ops[Op.MultiplyOp](vm); // Use Op enum
    expect(vm.getStackData()).toEqual([15]);
  });

  it("should throw an error for '*' with insufficient stack items", () => {
    vm.push(5);
    expect(() => ops[Op.MultiplyOp](vm)).toThrow("Stack underflow");
  });

  it("should handle the '/' word", () => {
    vm.push(6);
    vm.push(3);
    ops[Op.DivideOp](vm); // Use Op enum
    expect(vm.getStackData()).toEqual([2]);
  });

  it("should throw an error for '/' with insufficient stack items", () => {
    vm.push(5);
    expect(() => ops[Op.DivideOp](vm)).toThrow("Stack underflow");
  });

  it("should throw an error for division by zero", () => {
    vm.push(5);
    vm.push(0);
    expect(() => ops[Op.DivideOp](vm)).toThrow("Division by zero");
  });

  // Test 2: Stack manipulation
  it("should handle the 'dup' word", () => {
    vm.push(5);
    ops[Op.DupOp](vm); // Use Op enum
    expect(vm.getStackData()).toEqual([5, 5]);
  });

  it("should throw an error for 'dup' with an empty stack", () => {
    expect(() => ops[Op.DupOp](vm)).toThrow("Stack underflow");
  });

  it("should handle the 'drop' word", () => {
    vm.push(5);
    ops[Op.DropOp](vm); // Use Op enum
    expect(vm.getStackData()).toEqual([]);
  });

  it("should throw an error for 'drop' with an empty stack", () => {
    expect(() => ops[Op.DropOp](vm)).toThrow("Stack underflow");
  });

  it("should handle the 'swap' word", () => {
    vm.push(5);
    vm.push(3);
    ops[Op.SwapOp](vm); // Use Op enum
    expect(vm.getStackData()).toEqual([3, 5]);
  });

  it("should throw an error for 'swap' with insufficient stack items", () => {
    vm.push(5);
    expect(() => ops[Op.SwapOp](vm)).toThrow("Stack underflow");
  });

  // Test 3: Compilation mode
  it("should handle the '{' word", () => {
    ops[Op.LeftBrace](vm); // Use Op enum
    expect(vm.compiler.compileMode).toBe(true);
    expect(vm.getStackData()).toEqual([]);
  });

  it("should handle nested '{' words", () => {
    ops[Op.LeftBrace](vm); // Enter compilation mode
    ops[Op.LeftBrace](vm); // Treat second '{' as a regular word
    expect(vm.getStackData()).toEqual([]);
    const received = vm.compiler.getCodeData();
    expect(received).toEqual([Op.LeftBrace]); // Use Op enum
  });

  it("should throw an error for '}' outside compilation mode", () => {
    expect(() => ops[Op.RightBrace](vm)).toThrow(
      "Unexpected '}' outside compilation mode"
    );
  });

  it("should handle the '}' word", () => {
    vm.compiler.compileMode = true; // Enter compilation mode
    vm.compiler.nestingScore = 1; // Initialize nesting score
    vm.compiler.compileCode(Op.LiteralNumber); // Use Op enum
    vm.compiler.compileCode(5);

    vm.compiler.compileCode(Op.LiteralNumber); // Use Op enum
    vm.compiler.compileCode(3);
    vm.compiler.compileCode(Op.PlusOp); // Use Op enum
    ops[Op.RightBrace](vm); // Use Op enum
    expect(vm.compiler.compileMode).toBe(false);
    // const tos = vm.pop();
    // expect(tos).toBe(CODE);
    const received = vm.compiler.getCodeData();
    expect(received).toEqual([
      Op.LiteralNumber, // Use Op enum
      5,
      Op.LiteralNumber, // Use Op enum
      3,
      Op.PlusOp, // Use Op enum
      Op.ExitDef, // Use Op enum
    ]);
  });

  // Test 4: Immediate words
  it("should execute immediate words during compilation", () => {
    vm.compiler.compileMode = true; // Enter compilation mode

    // Execute an immediate word (e.g., '{')
    ops[Op.LeftBrace](vm); // Use Op enum

    // Verify that the immediate word was executed
    expect(vm.compiler.compileMode).toBe(true);
    expect(vm.compiler.nestingScore).toBe(1);

    // Verify that the immediate word is in the immediateWords array
    expect(immediateWords).toContain(Op.LeftBrace); // Use Op enum
  });
});

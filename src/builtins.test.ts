// src/builtins.test.ts
import { initializeInterpreter, vm } from "./globalState";
import { ops, Op, immediateWords } from "./builtins"; // Import Op enum
import { BUFFER, CODE } from "./constants";
import { execute } from "./interpreter";
import { lex } from "./lexer";
import { parse } from "./parser";

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

  // Test 3: Compilation mode
  it("should handle the '{' word", () => {
    ops[Op.LeftBrace](vm); // Use Op enum
    expect(vm.compiler.compileMode).toBe(true);
    expect(vm.getStackData()).toEqual([CODE + 1]);
  });

  it("should handle nested '{' words", () => {
    ops[Op.LeftBrace](vm); // Enter compilation mode
    ops[Op.LeftBrace](vm); // Treat second '{' as a regular word
    expect(vm.getStackData()).toEqual([CODE + 1, CODE + 3]);
    const received = vm.compiler.getData();
    expect(received).toEqual([Op.BranchCall, 0, Op.BranchCall, 0]); // Use Op enum
  });

  it("should throw an error for '}' outside compilation mode", () => {
    expect(() => ops[Op.RightBrace](vm)).toThrow(
      "Unexpected '}' outside compilation mode"
    );
  });

  it("should handle the '}' word", () => {
    ops[Op.LeftBrace](vm); // Enter compilation mode
    vm.compiler.compile(Op.LiteralNumber); // Use Op enum
    vm.compiler.compile(50);

    vm.compiler.compile(Op.LiteralNumber); // Use Op enum
    vm.compiler.compile(30);
    vm.compiler.compile(Op.Plus); // Use Op enum
    ops[Op.RightBrace](vm); // Use Op enum
    expect(vm.compiler.compileMode).toBe(false);
    const received = vm.compiler.getData();
    expect(received).toEqual([
      Op.BranchCall,
      6,
      Op.LiteralNumber, // Use Op enum
      50,
      Op.LiteralNumber, // Use Op enum
      30,
      Op.Plus, // Use Op enum
      Op.Exit, // Use Op enum
    ]);
  });

  // Test 4: Immediate words
  it("should execute immediate words during compilation", () => {
    vm.compiler.compileMode = true; // Enter compilation mode

    // Execute an immediate word (e.g., '{')
    ops[Op.LeftBrace](vm); // Use Op enum

    // Verify that the immediate word was executed
    expect(vm.compiler.compileMode).toBe(true);

    // Verify that the immediate word is in the immediateWords array
    expect(immediateWords).toContain(Op.LeftBrace); // Use Op enum
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

    it("should handle nested branches", () => {
      // Compile: { 5 { 3 + } }
      const tokens = lex("{ 5 { 3 + } }");
      parse(tokens);
      execute(BUFFER);
      expect(vm.getStackData()).toEqual([]);
      const received = vm.compiler.getData();
      console.log(received);
      expect(received).toEqual([
        Op.BranchCall,
        9, // Relative offset to the end of the definition
        Op.LiteralNumber,
        5,
        Op.BranchCall,
        4, // Relative offset to the end of the inner definition
        Op.LiteralNumber,
        3,
        Op.Plus,
        Op.Exit,
        Op.Exit,
      ]);
    });
  });
});

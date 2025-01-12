import { initializeInterpreter, vm } from "./globalState";
import { builtins, exitDef, literalNumber } from "./builtins";
import { getItems } from "./memory";

describe("Built-in Words", () => {
  beforeEach(() => {
    initializeInterpreter(); // Reset the interpreter state before each test
  });

  // Test 1: Arithmetic operations
  it("should handle the '+' word", () => {
    vm.push(5);
    vm.push(3);
    builtins["+"](vm); // Pass vm to the verb
    const received = vm.getStackItems();
    expect(received).toEqual([8]);
  });

  it("should throw an error for '+' with insufficient stack items", () => {
    vm.push(5);
    expect(() => builtins["+"](vm)).toThrow("Stack underflow");
  });

  it("should handle the '-' word", () => {
    vm.push(5);
    vm.push(3);
    builtins["-"](vm);
    expect(vm.getStackItems()).toEqual([2]);
  });

  it("should throw an error for '-' with insufficient stack items", () => {
    vm.push(5);
    expect(() => builtins["-"](vm)).toThrow("Stack underflow");
  });

  it("should handle the '*' word", () => {
    vm.push(5);
    vm.push(3);
    builtins["*"](vm);
    expect(vm.getStackItems()).toEqual([15]);
  });

  it("should throw an error for '*' with insufficient stack items", () => {
    vm.push(5);
    expect(() => builtins["*"](vm)).toThrow("Stack underflow");
  });

  it("should handle the '/' word", () => {
    vm.push(6);
    vm.push(3);
    builtins["/"](vm);
    expect(vm.getStackItems()).toEqual([2]);
  });

  it("should throw an error for '/' with insufficient stack items", () => {
    vm.push(5);
    expect(() => builtins["/"](vm)).toThrow("Stack underflow");
  });

  it("should throw an error for division by zero", () => {
    vm.push(5);
    vm.push(0);
    expect(() => builtins["/"](vm)).toThrow("Division by zero");
  });

  // Test 2: Stack manipulation
  it("should handle the 'dup' word", () => {
    vm.push(5);
    builtins["dup"](vm);
    expect(vm.getStackItems()).toEqual([5, 5]);
  });

  it("should throw an error for 'dup' with an empty stack", () => {
    expect(() => builtins["dup"](vm)).toThrow("Stack underflow");
  });

  it("should handle the 'drop' word", () => {
    vm.push(5);
    builtins["drop"](vm);
    expect(vm.getStackItems()).toEqual([]);
  });

  it("should throw an error for 'drop' with an empty stack", () => {
    expect(() => builtins["drop"](vm)).toThrow("Stack underflow");
  });

  it("should handle the 'swap' word", () => {
    vm.push(5);
    vm.push(3);
    builtins["swap"](vm);
    expect(vm.getStackItems()).toEqual([3, 5]);
  });

  it("should throw an error for 'swap' with insufficient stack items", () => {
    vm.push(5);
    expect(() => builtins["swap"](vm)).toThrow("Stack underflow");
  });

  // Test 3: Compilation mode
  it("should handle the '{' word", () => {
    builtins["{"](vm);
    expect(vm.compiler.compileMode).toBe(true);
    expect(vm.getStackItems()).toEqual([]);
  });

  it("should handle nested '{' words", () => {
    builtins["{"](vm); // Enter compilation mode
    builtins["{"](vm); // Treat second '{' as a regular word
    expect(vm.getStackItems()).toEqual([]);
    expect(
      vm.compiler.compileBuffer.data.slice(
        vm.compiler.compileBuffer.base,
        vm.compiler.compileBuffer.ofs
      )
    ).toEqual([builtins["{"]]);
  });

  it("should throw an error for '}' outside compilation mode", () => {
    expect(() => builtins["}"](vm)).toThrow(
      "Unexpected '}' outside compilation mode"
    );
  });

  it("should handle the '}' word", () => {
    vm.compiler.compileMode = true; // Enter compilation mode
    vm.compiler.nestingScore = 1; // Initialize nesting score
    vm.compiler.compile(vm.compiler.compileBuffer, literalNumber);
    vm.compiler.compile(vm.compiler.compileBuffer, 5);
    vm.compiler.compile(vm.compiler.compileBuffer, literalNumber);
    vm.compiler.compile(vm.compiler.compileBuffer, 3);
    vm.compiler.compile(vm.compiler.compileBuffer, builtins["+"]);
    builtins["}"](vm);
    expect(vm.compiler.compileMode).toBe(false);
    const tos = vm.pop();
    expect(typeof tos).toBe("number");
    expect(tos).toBe(vm.compiler.compileBuffer.base);
    const received = getItems(vm.compiler.compileBuffer);
    expect(received).toEqual([
      literalNumber,
      5,
      literalNumber,
      3,
      builtins["+"],
      exitDef
    ]);
  });
});

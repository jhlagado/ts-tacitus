import { initializeInterpreter, vm } from "./globalState";
import { builtins, literalNumber } from "./builtins";
import { getItems, getRef, pop, push } from "./memory";

describe("Built-in Words", () => {
  beforeEach(() => {
    console.log("Resetting VM state..."); // Debug log
    initializeInterpreter(); // Reset the interpreter state before each test
  });

  // Test 1: Arithmetic operations
  it("should handle the '+' word", () => {
    push(vm.stack, 5);
    push(vm.stack, 3);
    builtins["+"]();
    const received = getItems(vm.stack);
    console.log({ received });
    expect(received).toEqual([8]);
  });

  it("should throw an error for '+' with insufficient stack items", () => {
    push(vm.stack, 5);
    expect(() => builtins["+"]()).toThrow("Stack underflow");
  });

  it("should handle the '-' word", () => {
    push(vm.stack, 5);
    push(vm.stack, 3);
    builtins["-"]();
    expect(getItems(vm.stack)).toEqual([2]);
  });

  it("should throw an error for '-' with insufficient stack items", () => {
    push(vm.stack, 5);
    expect(() => builtins["-"]()).toThrow("Stack underflow");
  });

  it("should handle the '*' word", () => {
    push(vm.stack, 5);
    push(vm.stack, 3);
    builtins["*"]();
    expect(getItems(vm.stack)).toEqual([15]);
  });

  it("should throw an error for '*' with insufficient stack items", () => {
    push(vm.stack, 5);
    expect(() => builtins["*"]()).toThrow("Stack underflow");
  });

  it("should handle the '/' word", () => {
    push(vm.stack, 6);
    push(vm.stack, 3);
    builtins["/"]();
    expect(getItems(vm.stack)).toEqual([2]);
  });

  it("should throw an error for '/' with insufficient stack items", () => {
    push(vm.stack, 5);
    expect(() => builtins["/"]()).toThrow("Stack underflow");
  });

  it("should throw an error for division by zero", () => {
    push(vm.stack, 5);
    push(vm.stack, 0);
    expect(() => builtins["/"]()).toThrow("Division by zero");
  });

  // Test 2: Stack manipulation
  it("should handle the 'dup' word", () => {
    push(vm.stack, 5);
    builtins["dup"]();
    expect(getItems(vm.stack)).toEqual([5, 5]);
  });

  it("should throw an error for 'dup' with an empty stack", () => {
    expect(() => builtins["dup"]()).toThrow("Stack underflow");
  });

  it("should handle the 'drop' word", () => {
    push(vm.stack, 5);
    builtins["drop"]();
    expect(getItems(vm.stack)).toEqual([]);
  });

  it("should throw an error for 'drop' with an empty stack", () => {
    expect(() => builtins["drop"]()).toThrow("Stack underflow");
  });

  it("should handle the 'swap' word", () => {
    push(vm.stack, 5);
    push(vm.stack, 3);
    builtins["swap"]();
    expect(getItems(vm.stack)).toEqual([3, 5]);
  });

  it("should throw an error for 'swap' with insufficient stack items", () => {
    push(vm.stack, 5);
    expect(() => builtins["swap"]()).toThrow("Stack underflow");
  });

  // Test 3: Compilation mode
  it("should handle the '{' word", () => {
    builtins["{"]();
    const received = getItems(vm.compileBuffer);
    expect(vm.compileMode).toBe(true);
    expect(received).toEqual([]);
  });

  it("should handle nested '{' words", () => {
    builtins["{"](); // Enter compilation mode
    console.log("After first '{':", vm.compileBuffer); // Debug log
    builtins["{"](); // Treat second '{' as a regular word
    console.log("After second '{':", vm.compileBuffer); // Debug log
    const received = getItems(vm.compileBuffer);
    expect(received).toEqual([builtins["{"]]);
  });

  it("should throw an error for '}' outside compilation mode", () => {
    expect(() => builtins["}"]()).toThrow(
      "Unexpected '}' outside compilation mode"
    );
  });

  // it("should handle the '}' word", () => {
  //   vm.compileMode = true; // Enter compilation mode
  //   vm.nestingScore = 1; // Initialize nesting score
  //   push(vm.compileBuffer, literalNumber);
  //   push(vm.compileBuffer, 5);
  //   push(vm.compileBuffer, literalNumber);
  //   push(vm.compileBuffer, 3);
  //   push(vm.compileBuffer, builtins["+"]);
  //   builtins["}"]();
  //   expect(vm.compileMode).toBe(false);
  //   const tos = pop(vm.stack);
  //   expect(typeof tos).toBe("number");
  //   const ref = getRef(vm.heap, tos as number);
  //   const received = getItems(ref);
  //   expect(received).toEqual([
  //     literalNumber,
  //     5,
  //     literalNumber,
  //     3,
  //     builtins["+"],
  //   ]);
  // });
});

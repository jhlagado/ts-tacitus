// src/compiler.test.ts
import { initializeInterpreter, vm } from "./globalState";
import { Op } from "./ops/builtins"; // Import Op enum
import { fromTaggedPtr, Tag } from "./tagged-ptr";

describe("Compiler", () => {
  beforeEach(() => {
    initializeInterpreter(); // Reset the interpreter state before each test
  });

  it("should compile a positive integer as a tagged pointer", () => {
    vm.compiler.compile16(42);
    vm.reset();
    expect(vm.next16()).toBe(42);
  });

  it("should compile a negative integer as a tagged pointer", () => {
    vm.compiler.compile16(-42);
    vm.reset();
    expect(vm.next16()).toBe(-42);
  });

  it("should compile an address as a tagged pointer", () => {
    vm.compiler.compileAddress(0x12345); // Use compileAddress
    vm.reset();
    const nPtr = vm.nextFloat();
    const { pointer } = fromTaggedPtr(Tag.ADDRESS, nPtr);
    expect(pointer).toBe(0x12345);
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

// src/core/compiler.test.ts
import { addOp } from '../ops/basic/builtins';
import { initializeInterpreter, vm } from '../core/globalState';
import { fromTaggedValue } from '../core/tagged';

describe('Compiler', () => {
  beforeEach(() => {
    initializeInterpreter(); // Reset the interpreter state before each test
  });

  it('should compile a positive integer as a tagged pointer', () => {
    vm.compiler.compile16(42);
    vm.reset();
    expect(vm.next16()).toBe(42);
  });

  it('should compile a negative integer as a tagged pointer', () => {
    vm.compiler.compile16(-42);
    vm.reset();
    expect(vm.next16()).toBe(-42);
  });

  it('should compile an address as a tagged pointer', () => {
    vm.compiler.compileAddress(0x2345); // Use compileAddress
    vm.reset();
    const tagNum = vm.nextFloat32();
    const { value: pointer } = fromTaggedValue(tagNum);
    expect(pointer).toBe(0x2345);
  });

  it('should compile a literal number', () => {
    // Compile a literal number (using 255 as a test value)
    vm.compiler.compile8(255);
    vm.compiler.compileFloat32(42);
    vm.reset();
    expect(vm.next8()).toBe(255);
    expect(vm.nextFloat32()).toBeCloseTo(42);
  });

  it('should compile a built-in word', () => {
    // Compile a built-in operation
    vm.compiler.compileOp(addOp, true); // true indicates it's a built-in
    vm.reset();
    // Built-ins are encoded as a single byte (0-127)
    // addOp is the first built-in, so it should be 0
    expect(vm.next8()).toBe(0);
  });

  it('should compile a user-defined function call', () => {
    // Compile a user-defined operation
    vm.compiler.compileOp(addOp); // No second argument means it's user-defined
    vm.reset();
    // User calls are encoded as two bytes with high bit set on first byte
    // First operation has index 0, encoded as [0x80, 0x00]
    expect(vm.next8()).toBe(0x80); // 10000000
    expect(vm.next8()).toBe(0x00); // 00000000
  });

  it('should preserve compiled code when preserve is true', () => {
    vm.compiler.preserve = true;
    vm.compiler.compileFloat32(42); // Compile a value
    vm.compiler.reset(); // Reset with preserve flag
    expect(vm.compiler.BP).toBe(vm.compiler.CP); // BP should move to CP
  });
});

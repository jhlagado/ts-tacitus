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
    vm.compiler.compile8(255); // 255 is the marker for operations in the compiler
    vm.compiler.compileFloat32(42);
    vm.reset();
    expect(vm.next8()).toBe(255);
    expect(vm.nextFloat32()).toBeCloseTo(42);
  });

  it('should compile a built-in word', () => {
    // Store operation in compiler's operations array
    vm.compiler.compileOp(addOp); 
    vm.reset();
    // Should have compiled a marker (255) followed by the operation index (0)
    expect(vm.next8()).toBe(255); 
    expect(vm.next16()).toBe(0); // First operation has index 0
  });

  it('should preserve compiled code when preserve is true', () => {
    vm.compiler.preserve = true;
    vm.compiler.compileFloat32(42); // Compile a value
    vm.compiler.reset(); // Reset with preserve flag
    expect(vm.compiler.BP).toBe(vm.compiler.CP); // BP should move to CP
  });
});

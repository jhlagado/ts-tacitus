// src/core/compiler.test.ts
import { Op } from '../ops/opcodes';
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
    vm.compiler.compile8(Op.LiteralNumber); // Use Op enum
    vm.compiler.compileFloat32(42);
    vm.reset();
    expect(vm.next8()).toBe(Op.LiteralNumber);
    expect(vm.nextFloat32()).toBeCloseTo(42);
  });

  it('should compile a built-in word', () => {
    vm.compiler.compile8(Op.Plus); // Use Op enum
    vm.reset();
    expect(vm.next8()).toBe(Op.Plus); // Use next8 for opcodes
  });

  it('should preserve compiled code when preserve is true', () => {
    vm.compiler.preserve = true;
    vm.compiler.compileFloat32(42); // Compile a value
    vm.compiler.reset(); // Reset with preserve flag
    expect(vm.compiler.BCP).toBe(vm.compiler.CP); // BCP should move to CP
  });
});

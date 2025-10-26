import { Op } from '../../ops/opcodes';
import { initializeInterpreter, vm } from '../../lang/runtime';
import { fromTaggedValue } from '../../core';

describe('Compiler', () => {
  beforeEach(() => {
    initializeInterpreter();
  });
  test('should compile a positive integer as a tagged pointer', () => {
    vm.compiler.compile16(42);
    vm.IP = 0;
    expect(vm.nextInt16()).toBe(42);
  });
  test('should compile a negative integer as a tagged pointer', () => {
    vm.compiler.compile16(-42);
    vm.IP = 0;
    expect(vm.nextInt16()).toBe(-42);
  });
  test('should compile an address as a tagged pointer', () => {
    vm.compiler.compileAddress(0x2345);
    vm.IP = 0;
    const tagNum = vm.nextFloat32();
    const { value: pointer } = fromTaggedValue(tagNum);
    expect(pointer).toBe(0x2345);
  });
  test('should compile a literal number', () => {
    vm.compiler.compile8(Op.LiteralNumber);
    vm.compiler.compileFloat32(42);
    vm.IP = 0;
    expect(vm.next8()).toBe(Op.LiteralNumber);
    expect(vm.nextFloat32()).toBeCloseTo(42);
  });
  test('should compile a built-in word', () => {
    vm.compiler.compile8(Op.Add);
    vm.IP = 0;
    expect(vm.next8()).toBe(Op.Add);
  });
  test('should preserve compiled code when preserve is true', () => {
    vm.compiler.preserve = true;
    vm.compiler.compileFloat32(42);
    vm.compiler.reset();
    expect(vm.compiler.BCP).toBe(vm.compiler.CP);
  });
});

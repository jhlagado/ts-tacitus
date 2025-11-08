import { Op } from '../../ops/opcodes';
import { createVM, type VM } from '../../core/vm';
import { fromTaggedValue } from '../../core';
import { nextInt16, nextFloat32, next8 } from '../../core/vm';

describe('Compiler', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM();
  });
  test('should compile a positive integer as a tagged pointer', () => {
    vm.compiler.compile16(42);
    vm.IP = 0;
    expect(nextInt16(vm)).toBe(42);
  });
  test('should compile a negative integer as a tagged pointer', () => {
    vm.compiler.compile16(-42);
    vm.IP = 0;
    expect(nextInt16(vm)).toBe(-42);
  });
  test('should compile an address as a tagged pointer', () => {
    vm.compiler.compileAddress(0x2345);
    vm.IP = 0;
    const tagNum = nextFloat32(vm);
    const { value: pointer } = fromTaggedValue(tagNum);
    expect(pointer).toBe(0x2345);
  });
  test('should compile a literal number', () => {
    vm.compiler.compile8(Op.LiteralNumber);
    vm.compiler.compileFloat32(42);
    vm.IP = 0;
      expect(next8(vm)).toBe(Op.LiteralNumber);
      expect(nextFloat32(vm)).toBeCloseTo(42);
  });
  test('should compile a built-in word', () => {
    vm.compiler.compile8(Op.Add);
    vm.IP = 0;
      expect(next8(vm)).toBe(Op.Add);
  });
  test('should preserve compiled code when preserve is true', () => {
    vm.compiler.preserve = true;
    vm.compiler.compileFloat32(42);
    vm.compiler.reset();
    expect(vm.compiler.BCP).toBe(vm.compiler.CP);
  });
});

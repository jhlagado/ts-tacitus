import { Op } from '../../ops/opcodes';
import { createVM, type VM } from '../../core/vm';
import { fromTaggedValue, MIN_USER_OPCODE } from '../../core';
import { nextInt16, nextFloat32, next8 } from '../../core/vm';
import { encodeX1516 } from '../../core/code-ref';

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
    const address = 0x2345;
    vm.compiler.compileAddress(address);
    vm.IP = 0;
    const tagNum = nextFloat32(vm);
    const { value: pointer } = fromTaggedValue(tagNum);
    // compileAddress encodes the address using X1516 format
    expect(pointer).toBe(encodeX1516(address));
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

  describe('Error conditions and boundaries', () => {
    test('should throw error for invalid opcode addresses', () => {
      expect(() => vm.compiler.compileOpcode(-1)).toThrow('Invalid opcode address');
      expect(() => vm.compiler.compileOpcode(32768)).toThrow('Invalid opcode address');
      expect(() => vm.compiler.compileOpcode(32767)).not.toThrow();
    });

    test('should use correct encoding for built-in vs user opcodes', () => {
      const initialCP = vm.compiler.CP;
      vm.compiler.compileOpcode(5);
      expect(vm.compiler.CP).toBe(initialCP + 1);

      vm.compiler.CP = initialCP;
      vm.compiler.compileOpcode(MIN_USER_OPCODE);
      expect(vm.compiler.CP).toBe(initialCP + 2);
    });

    test('should throw error for invalid compileUserWordCall addresses', () => {
      expect(() => vm.compiler.compileUserWordCall(-1)).toThrow('Invalid opcode address');
      expect(() => vm.compiler.compileUserWordCall(32768)).toThrow('Invalid opcode address');
    });
  });
});

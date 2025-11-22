import { Op } from '../../ops/opcodes';
import { createVM, type VM } from '../../core/vm';
import { getTaggedInfo, MIN_USER_OPCODE } from '../../core';
import { nextInt16, nextFloat32, next8 } from '../../core/vm';
import { encodeX1516 } from '../../core/code-ref';
import {
  compilerCompile16,
  compilerCompileAddress,
  compilerCompileFloat32,
  compilerCompile8,
  compilerCompileOpcode,
  compilerCompileUserWordCall,
  compilerReset,
} from '../../lang/compiler';

describe('Compiler', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM();
  });
  test('should compile a positive integer as a tagged pointer', () => {
    compilerCompile16(vm, vm.compiler, 42);
    vm.ip = 0;
    expect(nextInt16(vm)).toBe(42);
  });
  test('should compile a negative integer as a tagged pointer', () => {
    compilerCompile16(vm, vm.compiler, -42);
    vm.ip = 0;
    expect(nextInt16(vm)).toBe(-42);
  });
  test('should compile an address as a tagged pointer', () => {
    const address = 0x2345;
    compilerCompileAddress(vm, vm.compiler, address);
    vm.ip = 0;
    const tagNum = nextFloat32(vm);
    const { value: pointer } = getTaggedInfo(tagNum);
    // compileAddress encodes the address using X1516 format
    expect(pointer).toBe(encodeX1516(address));
  });
  test('should compile a literal number', () => {
    compilerCompile8(vm, vm.compiler, Op.LiteralNumber);
    compilerCompileFloat32(vm, vm.compiler, 42);
    vm.ip = 0;
    expect(next8(vm)).toBe(Op.LiteralNumber);
    expect(nextFloat32(vm)).toBeCloseTo(42);
  });
  test('should compile a built-in word', () => {
    compilerCompile8(vm, vm.compiler, Op.Add);
    vm.ip = 0;
    expect(next8(vm)).toBe(Op.Add);
  });
  test('should preserve compiled code when preserve is true', () => {
    vm.compiler.preserve = true;
    compilerCompileFloat32(vm, vm.compiler, 42);
    compilerReset(vm.compiler);
    expect(vm.compiler.BCP).toBe(vm.compiler.CP);
  });

  describe('Error conditions and boundaries', () => {
    test('should throw error for invalid opcode addresses', () => {
      expect(() => compilerCompileOpcode(vm, vm.compiler, -1)).toThrow('Invalid opcode address');
      expect(() => compilerCompileOpcode(vm, vm.compiler, 32768)).toThrow('Invalid opcode address');
      expect(() => compilerCompileOpcode(vm, vm.compiler, 32767)).not.toThrow();
    });

    test('should use correct encoding for built-in vs user opcodes', () => {
      const initialCP = vm.compiler.CP;
      compilerCompileOpcode(vm, vm.compiler, 5);
      expect(vm.compiler.CP).toBe(initialCP + 1);

      vm.compiler.CP = initialCP;
      compilerCompileOpcode(vm, vm.compiler, MIN_USER_OPCODE);
      expect(vm.compiler.CP).toBe(initialCP + 2);
    });

    test('should throw error for invalid compileUserWordCall addresses', () => {
      expect(() => compilerCompileUserWordCall(vm, vm.compiler, -1)).toThrow('Invalid opcode address');
      expect(() => compilerCompileUserWordCall(vm, vm.compiler, 32768)).toThrow('Invalid opcode address');
    });
  });
});

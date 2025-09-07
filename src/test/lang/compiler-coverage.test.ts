/**
 * Tests for compiler.ts - targeting uncovered branches
 * This focuses on error conditions and edge cases not covered in main compiler tests
 */
import { describe, test, expect, beforeEach } from '@jest/globals';
import { vm, initializeInterpreter } from '../../core/globalState';
import { Compiler } from '../../lang/compiler';
import { MIN_USER_OPCODE } from '../../core';

describe('Compiler - Branch Coverage', () => {
  beforeEach(() => {
    initializeInterpreter();
  });

  describe('compileOpcode error conditions', () => {
    test('should throw error for negative opcode address', () => {
      expect(() => vm.compiler.compileOpcode(-1)).toThrow('Invalid opcode address: -1');
    });

    test('should throw error for opcode address >= 32768', () => {
      expect(() => vm.compiler.compileOpcode(32768)).toThrow('Invalid opcode address: 32768');
    });

    test('should throw error for very large opcode address', () => {
      expect(() => vm.compiler.compileOpcode(99999)).toThrow('Invalid opcode address: 99999');
    });

    test('should handle opcode address at boundary (32767)', () => {
      expect(() => vm.compiler.compileOpcode(32767)).not.toThrow();
    });
  });

  describe('compileOpcode encoding paths', () => {
    test('should use single-byte encoding for opcodes < MIN_USER_OPCODE', () => {
      const initialCP = vm.compiler.CP;
      vm.compiler.compileOpcode(5);

      expect(vm.compiler.CP).toBe(initialCP + 1);
    });

    test('should use two-byte encoding for opcodes >= MIN_USER_OPCODE', () => {
      const initialCP = vm.compiler.CP;
      vm.compiler.compileOpcode(MIN_USER_OPCODE);

      expect(vm.compiler.CP).toBe(initialCP + 2);
    });

    test('should properly encode large user opcodes', () => {
      const largeOpcode = MIN_USER_OPCODE + 1000;
      vm.compiler.compileOpcode(largeOpcode);

      vm.reset();
      const firstByte = vm.next8();
      const secondByte = vm.next8();

      expect(firstByte & 0x80).toBe(0x80);

      const decodedOpcode = ((secondByte & 0xff) << 7) | (firstByte & 0x7f);
      expect(decodedOpcode).toBe(largeOpcode);
    });
  });

  describe('compileUserWordCall', () => {
    test('should throw error for negative address', () => {
      expect(() => vm.compiler.compileUserWordCall(-1)).toThrow('Invalid opcode address: -1');
    });

    test('should throw error for address >= 32768', () => {
      expect(() => vm.compiler.compileUserWordCall(32768)).toThrow('Invalid opcode address: 32768');
    });

    test('should always use two-byte encoding regardless of address', () => {
      const initialCP = vm.compiler.CP;

      vm.compiler.compileUserWordCall(5);

      expect(vm.compiler.CP).toBe(initialCP + 2);
    });

    test('should properly encode user word call with MSB set', () => {
      vm.compiler.compileUserWordCall(100);

      vm.reset();
      const firstByte = vm.next8();

      expect(firstByte & 0x80).toBe(0x80);
    });
  });

  describe('patchOpcode error conditions', () => {
    test('should throw error for negative opcode address in patch', () => {
      expect(() => vm.compiler.patchOpcode(0, -1)).toThrow('Invalid opcode address: -1');
    });

    test('should throw error for opcode address >= 32768 in patch', () => {
      expect(() => vm.compiler.patchOpcode(0, 32768)).toThrow('Invalid opcode address: 32768');
    });

    test('should handle single-byte opcode patching', () => {
      vm.compiler.compile8(0);
      const patchAddress = vm.compiler.CP - 1;

      vm.compiler.patchOpcode(patchAddress, 5);

      vm.reset();
      vm.IP = patchAddress;
      expect(vm.next8()).toBe(5);
    });

    test('should handle two-byte opcode patching', () => {
      vm.compiler.compile8(0);
      vm.compiler.compile8(0);
      const patchAddress = vm.compiler.CP - 2;

      const largeOpcode = MIN_USER_OPCODE + 100;
      vm.compiler.patchOpcode(patchAddress, largeOpcode);

      vm.reset();
      vm.IP = patchAddress;
      const firstByte = vm.next8();
      const secondByte = vm.next8();

      expect(firstByte & 0x80).toBe(0x80);
      const decodedOpcode = ((secondByte & 0xff) << 7) | (firstByte & 0x7f);
      expect(decodedOpcode).toBe(largeOpcode);
    });
  });

  describe('Compiler reset behavior', () => {
    test('should save CP to BCP when preserve is true', () => {
      vm.compiler.CP = 100;
      vm.compiler.BCP = 50;
      vm.compiler.preserve = true;

      vm.compiler.reset();

      expect(vm.compiler.BCP).toBe(100);
      expect(vm.compiler.CP).toBe(100);
    });

    test('should restore CP from BCP when preserve is false', () => {
      vm.compiler.CP = 100;
      vm.compiler.BCP = 50;
      vm.compiler.preserve = false;

      vm.compiler.reset();

      expect(vm.compiler.CP).toBe(50);
      expect(vm.compiler.BCP).toBe(50);
    });
  });

  describe('Edge cases and boundary conditions', () => {
    test('should handle zero opcode address', () => {
      expect(() => vm.compiler.compileOpcode(0)).not.toThrow();
    });

    test('should handle MIN_USER_OPCODE boundary', () => {
      const initialCP1 = vm.compiler.CP;
      vm.compiler.compileOpcode(MIN_USER_OPCODE - 1);
      const bytesUsed1 = vm.compiler.CP - initialCP1;

      const initialCP2 = vm.compiler.CP;
      vm.compiler.compileOpcode(MIN_USER_OPCODE);
      const bytesUsed2 = vm.compiler.CP - initialCP2;

      expect(bytesUsed1).toBe(1);
      expect(bytesUsed2).toBe(2);
    });

    test('should handle maximum valid opcode address', () => {
      expect(() => vm.compiler.compileOpcode(32767)).not.toThrow();
    });

    test('should handle patching at various memory locations', () => {
      vm.compiler.compile8(1);
      vm.compiler.compile8(2);
      vm.compiler.compile8(3);
      vm.compiler.compile8(4);

      vm.compiler.patchOpcode(1, 99);

      vm.reset();
      expect(vm.next8()).toBe(1);
      expect(vm.next8()).toBe(99);
      expect(vm.next8()).toBe(3);
    });
  });

  describe('Compiler instance methods', () => {
    test('should work with new compiler instance', () => {
      const newCompiler = new Compiler(vm);

      expect(newCompiler.CP).toBe(0);
      expect(newCompiler.BCP).toBe(0);
      expect(newCompiler.preserve).toBe(false);
      expect(newCompiler.nestingScore).toBe(0);
    });

    test('should handle compile operations on new instance', () => {
      const newCompiler = new Compiler(vm);

      newCompiler.compile8(42);
      expect(newCompiler.CP).toBe(1);

      newCompiler.compile16(1000);
      expect(newCompiler.CP).toBe(3);
    });
  });
});

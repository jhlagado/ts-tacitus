/**
 * @file src/test/ops/globals/globalref-op.test.ts
 * Tests for GlobalRef opcode
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { createVM, type VM } from '../../../core/vm';
import { globalRefOp } from '../../../ops/builtins';
import { GLOBAL_BASE, GLOBAL_TOP, GLOBAL_SIZE } from '../../../core/constants';
import { getCellFromRef, isRef } from '../../../core/refs';
import { getStackData } from '../../../core/vm';

describe('GlobalRef opcode', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM();
    vm.debug = false;
  });

  describe('basic execution', () => {
    test('should push REF for valid offset 0', () => {
      vm.compiler.compile16(0);
      globalRefOp(vm);

      const stack = getStackData(vm);
      expect(stack.length).toBe(1);
      const ref = stack[0];
      expect(isRef(ref)).toBe(true);
      
      const absCellIndex = getCellFromRef(ref);
      expect(absCellIndex).toBe(GLOBAL_BASE);
    });

    test('should push REF for valid offset in middle of range', () => {
      const offset = Math.floor(GLOBAL_SIZE / 2);
      vm.compiler.compile16(offset);
      globalRefOp(vm);

      const stack = getStackData(vm);
      expect(stack.length).toBe(1);
      const ref = stack[0];
      expect(isRef(ref)).toBe(true);
      
      const absCellIndex = getCellFromRef(ref);
      expect(absCellIndex).toBe(GLOBAL_BASE + offset);
    });

    test('should push REF for maximum valid offset', () => {
      const maxOffset = GLOBAL_SIZE - 1;
      vm.compiler.compile16(maxOffset);
      globalRefOp(vm);

      const stack = getStackData(vm);
      expect(stack.length).toBe(1);
      const ref = stack[0];
      expect(isRef(ref)).toBe(true);
      
      const absCellIndex = getCellFromRef(ref);
      expect(absCellIndex).toBe(GLOBAL_BASE + maxOffset);
      expect(absCellIndex).toBeLessThan(GLOBAL_TOP);
    });
  });

  describe('boundary validation', () => {
    test('should throw error for offset that exceeds GLOBAL_SIZE', () => {
      const invalidOffset = GLOBAL_SIZE;
      vm.compiler.compile16(invalidOffset);

      expect(() => globalRefOp(vm)).toThrow();
    });

    test('should throw error for offset that results in absolute index >= GLOBAL_TOP', () => {
      const offset = GLOBAL_SIZE; // This would make cellIndex = GLOBAL_BASE + GLOBAL_SIZE = GLOBAL_TOP
      vm.compiler.compile16(offset);

      expect(() => globalRefOp(vm)).toThrow(/outside global area/);
    });

    test('should accept offset that results in absolute index = GLOBAL_TOP - 1', () => {
      const offset = GLOBAL_SIZE - 1;
      vm.compiler.compile16(offset);

      expect(() => globalRefOp(vm)).not.toThrow();
      const stack = getStackData(vm);
      const ref = stack[0];
      const absCellIndex = getCellFromRef(ref);
      expect(absCellIndex).toBe(GLOBAL_TOP - 1);
    });
  });

  describe('16-bit offset limit', () => {
    test('should handle maximum 16-bit offset (65535)', () => {
      const max16Bit = 0xffff;
      vm.compiler.compile16(max16Bit);

      // This may or may not throw depending on GLOBAL_SIZE
      // If GLOBAL_SIZE > 65535, it should work
      // If GLOBAL_SIZE <= 65535, it should throw
      if (max16Bit < GLOBAL_SIZE) {
        expect(() => globalRefOp(vm)).not.toThrow();
      } else {
        expect(() => globalRefOp(vm)).toThrow();
      }
    });
  });
});


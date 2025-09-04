import { ifCurlyBranchFalseOp } from '../../../ops/control';
/**
 * Tests for control-ops.ts - specifically targeting uncovered branches
 * This includes the deprecated simpleIfOp and edge cases for ifCurlyBranchFalseOp
 */
import { describe, test, expect, beforeEach } from '@jest/globals';
import { vm, initializeInterpreter } from '../../../core/globalState';
import { simpleIfOp } from '../../../ops/control';
import { toTaggedValue, Tag } from '../../../core/tagged';

describe('Control Operations - Branch Coverage', () => {
  beforeEach(() => {
    initializeInterpreter();
    vm.debug = false;
  });

  describe('simpleIfOp (deprecated ternary if)', () => {
    test('should execute then-code when condition is truthy', () => {
      vm.push(1);

      const codeAddr = 100;
      vm.push(toTaggedValue(codeAddr, Tag.CODE));
      vm.push(99);

      vm.memory.write8(3, codeAddr, 0);
      vm.memory.writeFloat32(3, codeAddr + 1, 42);
      vm.memory.write8(3, codeAddr + 5, 5);

      simpleIfOp(vm);

      expect(vm.IP).toBe(codeAddr);
      expect(vm.RP).toBeGreaterThan(0);
    });

    test('should execute else-code when condition is falsy', () => {
      vm.push(0);
      vm.push(42);

      const codeAddr = 200;
      vm.push(toTaggedValue(codeAddr, Tag.CODE));

      simpleIfOp(vm);

      expect(vm.IP).toBe(codeAddr);
      expect(vm.RP).toBeGreaterThan(0);
    });

    test('should push then-value when condition is truthy and then-branch is not code', () => {
      vm.push(1);
      vm.push(42);
      vm.push(99);

      simpleIfOp(vm);

      expect(vm.getStackData()).toEqual([42]);
    });

    test('should push else-value when condition is falsy and else-branch is not code', () => {
      vm.push(0);
      vm.push(42);
      vm.push(99);

      simpleIfOp(vm);

      expect(vm.getStackData()).toEqual([99]);
    });

    test('should throw error if condition is not a number', () => {
      vm.push(toTaggedValue(0, Tag.STRING));
      vm.push(42);
      vm.push(99);

      expect(() => simpleIfOp(vm)).toThrow("Type error: 'if' condition must be a number");
    });

    test('should throw on stack underflow', () => {
      vm.push(1);

      expect(() => simpleIfOp(vm)).toThrow('Stack underflow');
    });

    test('should reject CODE tagged values as conditions', () => {
      vm.push(toTaggedValue(100, Tag.CODE));
      vm.push(42);
      vm.push(99);

      expect(() => simpleIfOp(vm)).toThrow("Type error: 'if' condition must be a number");
    });

    test('should handle code in then-branch with truthy condition', () => {
      vm.push(5);

      const codeAddr = 150;
      vm.push(toTaggedValue(codeAddr, Tag.CODE));
      vm.push(toTaggedValue(250, Tag.CODE));

      simpleIfOp(vm);

      expect(vm.IP).toBe(codeAddr);
    });

    test('should handle mixed code and value branches', () => {
      vm.push(0);
      vm.push(toTaggedValue(150, Tag.CODE));
      vm.push(777);

      simpleIfOp(vm);

      expect(vm.getStackData()).toEqual([777]);
    });
  });

  describe('Edge cases for control operations', () => {
    test('should handle negative numbers as truthy conditions', () => {
      vm.push(-1);
      vm.push(42);
      vm.push(99);

      simpleIfOp(vm);

      expect(vm.getStackData()).toEqual([42]);
    });

    test('should handle large numbers as truthy conditions', () => {
      vm.push(999999);
      vm.push(42);
      vm.push(99);

      simpleIfOp(vm);

      expect(vm.getStackData()).toEqual([42]);
    });

    test('should handle very small positive numbers as truthy', () => {
      vm.push(0.001);
      vm.push(42);
      vm.push(99);

      simpleIfOp(vm);

      expect(vm.getStackData()).toEqual([42]);
    });

    test('should handle NaN as falsy (since NaN is falsy in JavaScript)', () => {
      vm.push(NaN);
      vm.push(42);
      vm.push(99);

      simpleIfOp(vm);

      expect(vm.getStackData()).toEqual([99]);
    });
  });

  describe('ifCurlyBranchFalseOp edge cases', () => {
    test('should handle non-number conditions by treating them as falsy', () => {
      const originalNextInt16 = vm.nextInt16;
      vm.nextInt16 = () => 10;

      vm.push(toTaggedValue(100, Tag.CODE));

      const originalIP = vm.IP;

  ifCurlyBranchFalseOp(vm);

      expect(vm.IP).toBe(originalIP + 10);

      vm.nextInt16 = originalNextInt16;
    });

    test('should not jump when condition is truthy number', () => {
      const originalNextInt16 = vm.nextInt16;
      vm.nextInt16 = () => 10;

      vm.push(5);

      const originalIP = vm.IP;

  ifCurlyBranchFalseOp(vm);

      expect(vm.IP).toBe(originalIP);

      vm.nextInt16 = originalNextInt16;
    });

    test('should jump when condition is zero', () => {
      const originalNextInt16 = vm.nextInt16;
      vm.nextInt16 = () => 15;

      vm.push(0);

      const originalIP = vm.IP;

  ifCurlyBranchFalseOp(vm);

      expect(vm.IP).toBe(originalIP + 15);

      vm.nextInt16 = originalNextInt16;
    });
  });
});

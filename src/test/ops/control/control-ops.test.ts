/**
 * Tests for control-ops.ts - specifically targeting uncovered branches
 * This includes the deprecated simpleIfOp and edge cases for ifCurlyBranchFalseOp
 */
import { describe, test, expect, beforeEach } from '@jest/globals';
import { vm, initializeInterpreter } from '../../../core/globalState';
import { simpleIfOp } from '../../../ops/control-ops';
import { toTaggedValue, Tag } from '../../../core/tagged';

describe('Control Operations - Branch Coverage', () => {
  beforeEach(() => {
    initializeInterpreter();
    vm.debug = false;
  });

  describe('simpleIfOp (deprecated ternary if)', () => {
    test('should execute then-code when condition is truthy', () => {
      // Set up: push condition (1), then-branch (code), else-branch (value)
      vm.push(1); // truthy condition

      // Create a code block that pushes 42
      const codeAddr = 100;
      vm.push(toTaggedValue(codeAddr, Tag.CODE)); // then-branch as code
      vm.push(99); // else-branch as value

      // Mock the code at address 100 to be a simple push operation
      vm.memory.write8(3, codeAddr, 0); // Op.LiteralNumber
      vm.memory.writeFloat32(3, codeAddr + 1, 42);
      vm.memory.write8(3, codeAddr + 5, 5); // Op.Exit

      simpleIfOp(vm);

      // Should have set up call frame for code execution
      expect(vm.IP).toBe(codeAddr);
      expect(vm.RP).toBeGreaterThan(0); // Return stack should have call frame
    });

    test('should execute else-code when condition is falsy', () => {
      // Set up: push condition (0), then-branch (value), else-branch (code)
      vm.push(0); // falsy condition
      vm.push(42); // then-branch as value

      const codeAddr = 200;
      vm.push(toTaggedValue(codeAddr, Tag.CODE)); // else-branch as code

      simpleIfOp(vm);

      // Should have set up call frame for code execution
      expect(vm.IP).toBe(codeAddr);
      expect(vm.RP).toBeGreaterThan(0); // Return stack should have call frame
    });

    test('should push then-value when condition is truthy and then-branch is not code', () => {
      vm.push(1); // truthy condition
      vm.push(42); // then-branch as value
      vm.push(99); // else-branch as value

      simpleIfOp(vm);

      expect(vm.getStackData()).toEqual([42]);
    });

    test('should push else-value when condition is falsy and else-branch is not code', () => {
      vm.push(0); // falsy condition
      vm.push(42); // then-branch as value
      vm.push(99); // else-branch as value

      simpleIfOp(vm);

      expect(vm.getStackData()).toEqual([99]);
    });

    test('should throw error if condition is not a number', () => {
      vm.push(toTaggedValue(0, Tag.STRING)); // non-number condition
      vm.push(42); // then-branch
      vm.push(99); // else-branch

      expect(() => simpleIfOp(vm)).toThrow("Type error: 'if' condition must be a number");
    });

    test('should throw on stack underflow', () => {
      vm.push(1); // only one item instead of three

      expect(() => simpleIfOp(vm)).toThrow('Stack underflow');
    });

    test('should reject INTEGER tagged values as conditions', () => {
      vm.push(toTaggedValue(1, Tag.SENTINEL)); // integer condition (should be rejected)
      vm.push(42); // then-branch as value
      vm.push(99); // else-branch as value

      expect(() => simpleIfOp(vm)).toThrow("Type error: 'if' condition must be a number");
    });

    test('should reject FUNC tagged values as conditions', () => {
      vm.push(toTaggedValue(100, Tag.CODE)); // func condition (should be rejected)
      vm.push(42); // then-branch as value
      vm.push(99); // else-branch as value

      expect(() => simpleIfOp(vm)).toThrow("Type error: 'if' condition must be a number");
    });

    test('should handle code in then-branch with truthy condition', () => {
      vm.push(5); // truthy condition

      const codeAddr = 150;
      vm.push(toTaggedValue(codeAddr, Tag.CODE)); // then-branch as code
      vm.push(toTaggedValue(250, Tag.CODE)); // else-branch as code (should not execute)

      simpleIfOp(vm);

      expect(vm.IP).toBe(codeAddr);
    });

    test('should handle mixed code and value branches', () => {
      vm.push(0); // falsy condition
      vm.push(toTaggedValue(150, Tag.CODE)); // then-branch as code (should not execute)
      vm.push(777); // else-branch as value

      simpleIfOp(vm);

      expect(vm.getStackData()).toEqual([777]);
    });
  });

  describe('Edge cases for control operations', () => {
    test('should handle negative numbers as truthy conditions', () => {
      vm.push(-1); // negative truthy condition
      vm.push(42); // then-branch
      vm.push(99); // else-branch

      simpleIfOp(vm);

      expect(vm.getStackData()).toEqual([42]);
    });

    test('should handle large numbers as truthy conditions', () => {
      vm.push(999999); // large truthy condition
      vm.push(42); // then-branch
      vm.push(99); // else-branch

      simpleIfOp(vm);

      expect(vm.getStackData()).toEqual([42]);
    });

    test('should handle very small positive numbers as truthy', () => {
      vm.push(0.001); // small positive truthy condition
      vm.push(42); // then-branch
      vm.push(99); // else-branch

      simpleIfOp(vm);

      expect(vm.getStackData()).toEqual([42]);
    });

    test('should handle NaN as falsy (since NaN is falsy in JavaScript)', () => {
      vm.push(NaN); // NaN condition (falsy in JavaScript)
      vm.push(42); // then-branch
      vm.push(99); // else-branch

      simpleIfOp(vm);

      expect(vm.getStackData()).toEqual([99]);
    });
  });

  describe('ifCurlyBranchFalseOp edge cases', () => {
    test('should handle non-number conditions by treating them as falsy', () => {
      // Mock vm.next16() to return an offset
      const originalNext16 = vm.next16;
      vm.next16 = () => 10; // Mock offset

      // Push a non-number condition (should be treated as falsy)
      vm.push(toTaggedValue(100, Tag.CODE));

      const originalIP = vm.IP;

      // Import and test ifCurlyBranchFalseOp
      const { ifCurlyBranchFalseOp } = require('../../../ops/control-ops');
      ifCurlyBranchFalseOp(vm);

      // Should have jumped by the offset since condition is not a number
      expect(vm.IP).toBe(originalIP + 10);

      // Restore original method
      vm.next16 = originalNext16;
    });

    test('should not jump when condition is truthy number', () => {
      const originalNext16 = vm.next16;
      vm.next16 = () => 10; // Mock offset

      // Push a truthy number condition
      vm.push(5);

      const originalIP = vm.IP;

      const { ifCurlyBranchFalseOp } = require('../../../ops/control-ops');
      ifCurlyBranchFalseOp(vm);

      // Should NOT have jumped since condition is truthy
      expect(vm.IP).toBe(originalIP);

      vm.next16 = originalNext16;
    });

    test('should jump when condition is zero', () => {
      const originalNext16 = vm.next16;
      vm.next16 = () => 15; // Mock offset

      // Push zero (falsy) condition
      vm.push(0);

      const originalIP = vm.IP;

      const { ifCurlyBranchFalseOp } = require('../../../ops/control-ops');
      ifCurlyBranchFalseOp(vm);

      // Should have jumped since condition is zero (falsy)
      expect(vm.IP).toBe(originalIP + 15);

      vm.next16 = originalNext16;
    });
  });
});

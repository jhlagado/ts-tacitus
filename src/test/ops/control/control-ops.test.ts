/**
 * Tests for control-ops.ts - specifically targeting uncovered branches
 */
import { describe, test, expect, beforeEach } from '@jest/globals';
import { vm, initializeInterpreter } from '../../../lang/runtime';
import { ifFalseBranchOp } from '../../../ops/control';
import { toTaggedValue, Tag } from '../../../core/tagged';

describe('Control Operations - Branch Coverage', () => {
  beforeEach(() => {
    initializeInterpreter();
    vm.debug = false;
  });

  describe('ifFalseBranchOp edge cases', () => {
    test('should handle non-number conditions by treating them as falsy', () => {
      const originalNextInt16 = vm.nextInt16;
      vm.nextInt16 = () => 10;

      vm.push(toTaggedValue(100, Tag.CODE));

      const originalIP = vm.IP;

      ifFalseBranchOp(vm);

      expect(vm.IP).toBe(originalIP + 10);

      vm.nextInt16 = originalNextInt16;
    });

    test('should not jump when condition is truthy number', () => {
      const originalNextInt16 = vm.nextInt16;
      vm.nextInt16 = () => 10;

      vm.push(5);

      const originalIP = vm.IP;

      ifFalseBranchOp(vm);

      expect(vm.IP).toBe(originalIP);

      vm.nextInt16 = originalNextInt16;
    });

    test('should jump when condition is zero', () => {
      const originalNextInt16 = vm.nextInt16;
      vm.nextInt16 = () => 15;

      vm.push(0);

      const originalIP = vm.IP;

      ifFalseBranchOp(vm);

      expect(vm.IP).toBe(originalIP + 15);

      vm.nextInt16 = originalNextInt16;
    });
  });
});

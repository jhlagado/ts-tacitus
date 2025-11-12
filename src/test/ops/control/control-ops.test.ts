/**
 * Tests for control-ops.ts - specifically targeting uncovered branches
 */
import { describe, test, expect, beforeEach } from '@jest/globals';
import { createVM, type VM } from '../../../core/vm';
import { ifFalseBranchOp } from '../../../ops/control';
import { toTaggedValue, Tag } from '../../../core/tagged';
import * as vmModule from '../../../core/vm';
import * as conditionalOpsModule from '../../../ops/control/conditional-ops';
import { push } from '../../../core/vm';
import { encodeX1516 } from '../../../core/code-ref';

describe('Control Operations - Branch Coverage', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM();
    vm.debug = false;
  });

  describe('ifFalseBranchOp edge cases', () => {
    test('should handle non-number conditions by treating them as falsy', () => {
      // Mock nextInt16 by temporarily replacing it in the module
      const originalNextInt16 = vmModule.nextInt16;
      (vmModule as any).nextInt16 = () => 10;

      push(vm, toTaggedValue(encodeX1516(100), Tag.CODE));

      const originalIP = vm.IP;

      ifFalseBranchOp(vm);

      expect(vm.IP).toBe(originalIP + 10);

      (vmModule as any).nextInt16 = originalNextInt16;
    });

    test('should not jump when condition is truthy number', () => {
      const originalNextInt16 = vmModule.nextInt16;
      (vmModule as any).nextInt16 = () => 10;

      push(vm, 5);

      const originalIP = vm.IP;

      ifFalseBranchOp(vm);

      expect(vm.IP).toBe(originalIP);

      (vmModule as any).nextInt16 = originalNextInt16;
    });

    test('should jump when condition is zero', () => {
      const originalNextInt16 = vmModule.nextInt16;
      (vmModule as any).nextInt16 = () => 15;

      push(vm, 0);

      const originalIP = vm.IP;

      ifFalseBranchOp(vm);

      expect(vm.IP).toBe(originalIP + 15);

      (vmModule as any).nextInt16 = originalNextInt16;
    });
  });
});

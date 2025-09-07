/**
 * @file src/test/core/vm-unified-dispatch.test.ts
 *
 * Tests for VM-level unified dispatch system.
 * Verifies that both Tag.BUILTIN and Tag.CODE values work correctly with evalOp
 * without any language changes - pure VM-level testing.
 */

import { vm } from '../../core/globalState';
import { resetVM } from '../utils/vm-test-utils';
import { createBuiltinRef } from '../../core';
import { toTaggedValue, Tag } from '../../core';
import { Op } from '../../ops/opcodes';
import { evalOp } from '../../ops/core';

describe('VM Unified Dispatch', () => {
  beforeEach(() => {
    resetVM();
  });

  describe('Tag.BUILTIN dispatch via evalOp', () => {
    test('should execute built-in Add operation directly', () => {
      vm.push(2);
      vm.push(3);
      vm.push(createBuiltinRef(Op.Add));

      evalOp(vm);

      expect(vm.getStackData()).toEqual([5]);
    });

    test('should execute built-in Dup operation directly', () => {
      vm.push(42);
      vm.push(createBuiltinRef(Op.Dup));

      evalOp(vm);

      expect(vm.getStackData()).toEqual([42, 42]);
    });

    test('should execute built-in Swap operation', () => {
      vm.push(1);
      vm.push(2);
      vm.push(createBuiltinRef(Op.Swap));

      evalOp(vm);

      expect(vm.getStackData()).toEqual([2, 1]);
    });

    test('should execute built-in Drop operation', () => {
      vm.push(1);
      vm.push(2);
      vm.push(3);
      vm.push(createBuiltinRef(Op.Drop));

      evalOp(vm);

      expect(vm.getStackData()).toEqual([1, 2]);
    });
  });

  describe('non-executable values', () => {
    test('should push back non-executable values unchanged', () => {
      const nonExecutableValues = [42, toTaggedValue(100, Tag.STRING), toTaggedValue(5, Tag.LIST)];

      nonExecutableValues.forEach(value => {
        resetVM();
        vm.push(value);

        evalOp(vm);

        expect(vm.getStackData()).toEqual([value]);
      });
    });
  });

  describe('error cases', () => {
    test('should handle invalid built-in opcodes gracefully', () => {
      const invalidBuiltinRef = toTaggedValue(200, Tag.BUILTIN);
      vm.push(invalidBuiltinRef);

      expect(() => evalOp(vm)).toThrow();
    });

    test('should handle stack underflow in built-ins', () => {
      vm.push(5);
      vm.push(createBuiltinRef(Op.Add));

      expect(() => evalOp(vm)).toThrow();
    });

    test('should handle empty stack with evalOp', () => {
      expect(() => evalOp(vm)).toThrow();
    });
  });

  describe('performance verification', () => {
    test('should execute built-ins without call frame overhead', () => {
      const originalRP = vm.RP;

      vm.push(2);
      vm.push(3);
      vm.push(createBuiltinRef(Op.Add));
      evalOp(vm);

      expect(vm.RP).toBe(originalRP);
      expect(vm.getStackData()).toEqual([5]);
    });

    test('should handle complex sequences efficiently', () => {
      vm.push(2);
      vm.push(3);
      vm.push(createBuiltinRef(Op.Add));
      evalOp(vm);

      vm.push(4);
      vm.push(5);
      vm.push(createBuiltinRef(Op.Add));
      evalOp(vm);

      vm.push(createBuiltinRef(Op.Multiply));
      evalOp(vm);

      expect(vm.getStackData()).toEqual([45]);
    });
  });
});

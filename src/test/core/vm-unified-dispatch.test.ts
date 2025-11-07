/**
 * @file src/test/core/vm-unified-dispatch.test.ts
 *
 * Tests for VM-level unified dispatch system.
 * Verifies that both Tag.BUILTIN and Tag.CODE values work correctly with evalOp
 * without any language changes - pure VM-level testing.
 */

import { vm } from '../../lang/runtime';
import { push, getStackData } from '../../core/vm';
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
      push(vm, 2);
      push(vm, 3);
      push(vm, createBuiltinRef(Op.Add));

      evalOp(vm);

      expect(getStackData(vm)).toEqual([5]);
    });

    test('should execute built-in Dup operation directly', () => {
      push(vm, 42);
      push(vm, createBuiltinRef(Op.Dup));

      evalOp(vm);

      expect(getStackData(vm)).toEqual([42, 42]);
    });

    test('should execute built-in Swap operation', () => {
      push(vm, 1);
      push(vm, 2);
      push(vm, createBuiltinRef(Op.Swap));

      evalOp(vm);

      expect(getStackData(vm)).toEqual([2, 1]);
    });

    test('should execute built-in Drop operation', () => {
      push(vm, 1);
      push(vm, 2);
      push(vm, 3);
      push(vm, createBuiltinRef(Op.Drop));

      evalOp(vm);

      expect(getStackData(vm)).toEqual([1, 2]);
    });
  });

  describe('non-executable values', () => {
    test('should push back non-executable values unchanged', () => {
      const nonExecutableValues = [42, toTaggedValue(100, Tag.STRING), toTaggedValue(5, Tag.LIST)];

      nonExecutableValues.forEach(value => {
        resetVM();
        push(vm, value);

        evalOp(vm);

        expect(getStackData(vm)).toEqual([value]);
      });
    });
  });

  describe('error cases', () => {
    test('should handle invalid built-in opcodes gracefully', () => {
      const invalidBuiltinRef = toTaggedValue(200, Tag.BUILTIN);
      push(vm, invalidBuiltinRef);

      expect(() => evalOp(vm)).toThrow();
    });

    test('should handle stack underflow in built-ins', () => {
      push(vm, 5);
      push(vm, createBuiltinRef(Op.Add));

      expect(() => evalOp(vm)).toThrow();
    });

    test('should handle empty stack with evalOp', () => {
      expect(() => evalOp(vm)).toThrow();
    });
  });

  describe('performance verification', () => {
    test('should execute built-ins without call frame overhead', () => {
      const originalRSP = vm.rsp;

      push(vm, 2);
      push(vm, 3);
      push(vm, createBuiltinRef(Op.Add));
      evalOp(vm);

      expect(vm.rsp).toBe(originalRSP);
      expect(getStackData(vm)).toEqual([5]);
    });

    test('should handle complex sequences efficiently', () => {
      push(vm, 2);
      push(vm, 3);
      push(vm, createBuiltinRef(Op.Add));
      evalOp(vm);

      push(vm, 4);
      push(vm, 5);
      push(vm, createBuiltinRef(Op.Add));
      evalOp(vm);

      push(vm, createBuiltinRef(Op.Multiply));
      evalOp(vm);

      expect(getStackData(vm)).toEqual([45]);
    });
  });
});

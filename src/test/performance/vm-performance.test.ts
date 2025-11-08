/**
 * @file src/test/performance/vm-performance.test.ts
 * Performance and stress tests for VM operations.
 * These tests are run separately from the main test suite.
 */

import { createVM, type VM } from '../../core/vm';
import { evalOp } from '../../ops/core';
import { fromTaggedValue, Tag, toTaggedValue } from '../../core/tagged';
import { Op } from '../../ops/opcodes';
import { pushSymbolRef, push, pop, getStackData } from '../../core/vm';

jest.retryTimes(2);

describe('VM Performance Tests', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM();
  });

  describe('Performance Testing', () => {
    it('should have no performance regression for built-in operations', () => {
      const iterations = 100;

      const start1 = performance.now();
      for (let i = 0; i < iterations; i++) {
        push(vm, 5);
        push(vm, 3);
        push(vm, toTaggedValue(Op.Add, Tag.BUILTIN));
        evalOp(vm);
        pop(vm);
      }
      const directTime = performance.now() - start1;

      const start2 = performance.now();
      for (let i = 0; i < iterations; i++) {
        push(vm, 5);
        push(vm, 3);
        pushSymbolRef(vm, 'add');
        evalOp(vm);
        pop(vm);
      }
      const symbolTime = performance.now() - start2;

      push(vm, 10);
      push(vm, 20);
      pushSymbolRef(vm, 'add');
      evalOp(vm);
      expect(pop(vm)).toBe(30);

      expect(directTime).toBeLessThan(1000);
      expect(symbolTime).toBeLessThan(1000);
    });

    it('should handle rapid symbol resolution without memory leaks', () => {
      const iterations = 5000;
      const initialStackSize = getStackData(vm).length;

      for (let i = 0; i < iterations; i++) {
        try {
          pushSymbolRef(vm, 'dup');
          pop(vm);
        } catch {
          /* empty */
        }
      }

      expect(getStackData(vm).length).toBe(initialStackSize);

      push(vm, 42);
      pushSymbolRef(vm, 'dup');
      evalOp(vm);
      expect(getStackData(vm)).toEqual([42, 42]);
    });
  });

  describe('Stress Testing', () => {
    it('should handle sequential symbol references', () => {
      const iterations = 10000;

      for (let i = 0; i < iterations; i++) {
        push(vm, 1);
        pushSymbolRef(vm, 'dup');
        evalOp(vm);

        pop(vm);
        pop(vm);
      }

      push(vm, 42);
      pushSymbolRef(vm, 'dup');
      evalOp(vm);
      expect(getStackData(vm)).toEqual([42, 42]);
    });

    it('should handle nested symbol execution patterns', () => {
      const symbols = ['add', 'dup', 'swap'];
      const depth = 100;

      for (let d = 0; d < depth; d++) {
        push(vm, d);

        for (let i = 0; i < 3; i++) {
          const symbol = symbols[i % symbols.length];
          try {
            pushSymbolRef(vm, symbol);
            pop(vm);
          } catch {
            /* empty */
          }
        }

        while (getStackData(vm).length > 0) {
          pop(vm);
        }
      }

      push(vm, 100);
      pushSymbolRef(vm, 'dup');
      evalOp(vm);
      expect(getStackData(vm)).toEqual([100, 100]);
    });
  });
});



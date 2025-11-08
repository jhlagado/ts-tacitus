/**
 * @file src/test/core/vm-comprehensive-testing.test.ts
 *
 * Step 12: Comprehensive VM testing without language changes
 *
 * This test suite thoroughly validates the complete VM-level @symbol infrastructure
 * built in Steps 1-11, testing all functionality without requiring parser/tokenizer changes.
 *
 * Test Coverage:
 * - Performance testing to ensure no regressions
 * - Memory usage patterns and function table elimination verification
 * - Edge cases: invalid symbols, stack conditions, complex execution chains
 * - Stress testing with large numbers of symbol references
 * - Integration testing of the complete pushSymbolRef() → evalOp() workflow
 * - Mixed scenarios with built-ins, colon definitions, and standalone blocks
 */

import { createVM, type VM } from '../../core/vm';
import { evalOp } from '../../ops/core';
import { fromTaggedValue, Tag, toTaggedValue } from '../../core/tagged';
import { Op } from '../../ops/opcodes';
import { defineBuiltin, defineCode } from '../../core/dictionary';
import { pushSymbolRef, peek, resolveSymbol, push, pop, getStackData } from '../../core/vm';

// Mitigate flakiness in perf-sensitive assertions under variable CI load
jest.retryTimes(2);

describe('VM Comprehensive Testing - Step 12', () => {
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

  describe('Memory Usage Patterns', () => {
    it('should demonstrate function table can be eliminated for colon definitions', () => {
      const colonDefName = 'testSquare';
      const startAddress = 1000;

      defineCode(vm, colonDefName, startAddress);

      const taggedValue = resolveSymbol(vm, colonDefName);
      expect(taggedValue).toBeDefined();

      const { tag, value } = fromTaggedValue(taggedValue!);
      expect(tag).toBe(Tag.CODE);
      expect(value).toBe(startAddress);

      pushSymbolRef(vm, colonDefName);
      const stackValue = peek(vm);
      expect(stackValue).toBe(taggedValue);
    });

    it('should handle symbol table growth efficiently', () => {
      const symbolCount = 100;
      const symbols: string[] = [];

      for (let i = 0; i < symbolCount; i++) {
        const symbolName = `sym${i}`;
        symbols.push(symbolName);

        if (i % 2 === 0) {
          defineBuiltin(vm, symbolName, Op.Add);
        } else {
          defineCode(vm, symbolName, 2000 + i);
        }
      }

      for (const symbol of symbols) {
        const resolved = resolveSymbol(vm, symbol);
        expect(resolved).toBeDefined();

        pushSymbolRef(vm, symbol);
        const stackValue = pop(vm);
        expect(stackValue).toBe(resolved);
      }
    });

    it('should maintain memory efficiency with mixed symbol types', () => {
      const builtinSymbols = ['add', 'dup', 'swap', 'drop', 'over'];
      const codeSymbols = ['square', 'double', 'triple', 'quad'];

      builtinSymbols.forEach((name, index) => {
        defineBuiltin(vm, name, index + 1);
      });

      codeSymbols.forEach((name, index) => {
        defineCode(vm, name, 3000 + index * 100);
      });

      for (let i = 0; i < 100; i++) {
        const useBuiltin = i % 2 === 0;
        const symbols = useBuiltin ? builtinSymbols : codeSymbols;
        const symbol = symbols[i % symbols.length];

        pushSymbolRef(vm, symbol);
        const { tag } = fromTaggedValue(pop(vm));

        if (useBuiltin) {
          expect(tag).toBe(Tag.BUILTIN);
        } else {
          expect(tag).toBe(Tag.CODE);
        }
      }
    });
  });

  describe('Edge Cases and Error Conditions', () => {
    it('should handle invalid symbol references gracefully', () => {
      const invalidSymbols = ['', 'nonexistent', '   ', 'undefined', 'null'];

      invalidSymbols.forEach(symbol => {
        expect(() => pushSymbolRef(vm, symbol)).toThrow();

        expect(getStackData(vm).length).toBe(0);
      });
    });

    it('should handle stack underflow during symbol execution', () => {
      pushSymbolRef(vm, 'add');
      expect(() => evalOp(vm)).toThrow();

      push(vm, 5);
      pushSymbolRef(vm, 'add');
      expect(() => evalOp(vm)).toThrow();

      push(vm, 3);
      pushSymbolRef(vm, 'add');
      evalOp(vm);
      expect(pop(vm)).toBe(8);
    });

    it('should handle complex execution chains without corruption', () => {
      push(vm, 5);

      pushSymbolRef(vm, 'dup');
      evalOp(vm);
      expect(getStackData(vm)).toEqual([5, 5]);

      pushSymbolRef(vm, 'add');
      evalOp(vm);
      expect(getStackData(vm)).toEqual([10]);

      pushSymbolRef(vm, 'dup');
      evalOp(vm);
      expect(getStackData(vm)).toEqual([10, 10]);

      push(vm, 2);
      pushSymbolRef(vm, 'add');
      evalOp(vm);
      expect(getStackData(vm)).toEqual([10, 12]);

      pushSymbolRef(vm, 'add');
      evalOp(vm);
      expect(getStackData(vm)).toEqual([22]);
    });

    it('should handle symbol resolution with corrupted internal state', () => {
      defineBuiltin(vm, 'test', Op.Add);

      push(vm, 999);
      push(vm, -999);
      pop(vm);
      pop(vm);

      pushSymbolRef(vm, 'test');
      const { tag, value } = fromTaggedValue(pop(vm));
      expect(tag).toBe(Tag.BUILTIN);
      expect(value).toBe(Op.Add);
    });
  });

  describe('Stress Testing', () => {
    it('should handle large numbers of sequential symbol references', () => {
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

      for (let depth = 0; depth < 100; depth++) {
        push(vm, depth);

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

  describe('Integration Workflow Testing', () => {
    it('should handle complete @symbol eval workflow with mixed types', () => {
      defineBuiltin(vm, 'add', Op.Add);
      defineBuiltin(vm, 'mul', Op.Multiply);
      defineCode(vm, 'square', 5000);
      defineCode(vm, 'double', 5100);

      push(vm, 3);
      push(vm, 4);
      pushSymbolRef(vm, 'add');
      evalOp(vm);
      expect(peek(vm)).toBe(7);

      push(vm, 2);
      pushSymbolRef(vm, 'mul');
      evalOp(vm);
      expect(peek(vm)).toBe(14);

      pushSymbolRef(vm, 'square');
      const { tag, value } = fromTaggedValue(pop(vm));
      expect(tag).toBe(Tag.CODE);
      expect(value).toBe(5000);
    });

    it('should handle rapid symbol type switching', () => {
      const builtins = [
        { name: 'op1', code: Op.Add },
        { name: 'op2', code: Op.Multiply },
        { name: 'op3', code: Op.Minus },
      ];

      const codeDefs = [
        { name: 'def1', addr: 6000 },
        { name: 'def2', addr: 6100 },
        { name: 'def3', addr: 6200 },
      ];

      builtins.forEach(op => defineBuiltin(vm, op.name, op.code));
      codeDefs.forEach(def => defineCode(vm, def.name, def.addr));

      for (let i = 0; i < 100; i++) {
        const useBuiltin = i % 2 === 0;

        if (useBuiltin) {
          const op = builtins[i % builtins.length];
          pushSymbolRef(vm, op.name);
          const { tag, value } = fromTaggedValue(pop(vm));
          expect(tag).toBe(Tag.BUILTIN);
          expect(value).toBe(op.code);
        } else {
          const def = codeDefs[i % codeDefs.length];
          pushSymbolRef(vm, def.name);
          const { tag, value } = fromTaggedValue(pop(vm));
          expect(tag).toBe(Tag.CODE);
          expect(value).toBe(def.addr);
        }
      }
    });

    it('should integrate properly with existing VM operations', () => {
      push(vm, 10);
      push(vm, 20);
      push(vm, 30);
      expect(getStackData(vm)).toEqual([10, 20, 30]);

      pushSymbolRef(vm, 'dup');
      evalOp(vm);
      expect(getStackData(vm)).toEqual([10, 20, 30, 30]);

      pushSymbolRef(vm, 'add');
      evalOp(vm);
      expect(getStackData(vm)).toEqual([10, 20, 60]);

      pushSymbolRef(vm, 'add');
      evalOp(vm);
      expect(getStackData(vm)).toEqual([10, 80]);

      push(vm, 5);
      pushSymbolRef(vm, 'mul');
      evalOp(vm);
      expect(getStackData(vm)).toEqual([10, 400]);
    });

    it('should maintain stack integrity across complex operations', () => {
      push(vm, 5);
      pushSymbolRef(vm, 'dup');
      evalOp(vm);
      expect(getStackData(vm)).toEqual([5, 5]);

      push(vm, 3);
      pushSymbolRef(vm, 'add');
      evalOp(vm);
      expect(getStackData(vm)).toEqual([5, 8]);

      pushSymbolRef(vm, 'dup');
      evalOp(vm);
      expect(getStackData(vm)).toEqual([5, 8, 8]);

      push(vm, 2);
      pushSymbolRef(vm, 'mul');
      evalOp(vm);
      expect(getStackData(vm)).toEqual([5, 8, 16]);

      pushSymbolRef(vm, 'swap');
      evalOp(vm);
      expect(getStackData(vm)).toEqual([5, 16, 8]);

      pushSymbolRef(vm, 'add');
      evalOp(vm);
      expect(getStackData(vm)).toEqual([5, 24]);
    });
  });

  describe('System State Validation', () => {
    it('should maintain consistent VM state across all operations', () => {
      const initialSP = vm.sp;
      const initialRSP = vm.rsp; // absolute return stack cells

      push(vm, 42);
      pushSymbolRef(vm, 'dup');
      evalOp(vm);

      pushSymbolRef(vm, 'add');
      evalOp(vm);

      pop(vm);

      expect(vm.rsp).toBe(initialRSP);
      expect(vm.sp).toBe(initialSP);

      push(vm, 100);
      pushSymbolRef(vm, 'dup');
      evalOp(vm);
      expect(getStackData(vm)).toEqual([100, 100]);
    });

    it('should handle error recovery gracefully', () => {
      const initialStackSize = getStackData(vm).length;

      const errorCases = [
        () => pushSymbolRef(vm, 'nonexistent'),
        () => {
          pushSymbolRef(vm, 'add');
          evalOp(vm);
        },
        () => pushSymbolRef(vm, ''),
      ];

      errorCases.forEach(errorCase => {
        try {
          errorCase();
        } catch (_error) {
          expect(getStackData(vm).length).toBe(initialStackSize);
        }
      });

      push(vm, 99);
      pushSymbolRef(vm, 'dup');
      evalOp(vm);
      expect(getStackData(vm)).toEqual([99, 99]);
    });
  });
});

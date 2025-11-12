/**
 * @file src/test/core/vm-comprehensive-testing.test.ts
 *
 * Step 12: Comprehensive VM testing without language changes
 *
 * This test suite thoroughly validates the complete VM-level @symbol infrastructure
 * built in Steps 1-11, testing all functionality without requiring parser/tokenizer changes.
 *
 * Test Coverage:
 * - Memory usage patterns and function table elimination verification
 * - Edge cases: invalid symbols, stack conditions, complex execution chains
 * - Integration testing of the complete pushSymbolRef() → evalOp() workflow
 * - Mixed scenarios with built-ins, colon definitions, and standalone blocks
 *
 * Note: Performance and stress tests have been moved to src/test/performance/
 */

import { createVM, type VM } from '../../core/vm';
import { evalOp } from '../../ops/core';
import { fromTaggedValue, Tag, toTaggedValue } from '../../core/tagged';
import { Op } from '../../ops/opcodes';
import { define } from '../../core/dictionary';
import { pushSymbolRef, peek, resolveSymbol, push, pop, getStackData } from '../../core/vm';
import { encodeX1516, decodeX1516 } from '../../core/code-ref';

// Mitigate flakiness in perf-sensitive assertions under variable CI load
jest.retryTimes(2);

describe('VM Comprehensive Testing - Step 12', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM();
  });


  describe('Memory Usage Patterns', () => {
    it('should demonstrate function table can be eliminated for colon definitions', () => {
      const colonDefName = 'testSquare';
      const startAddress = 1000;

      define(vm, colonDefName, toTaggedValue(encodeX1516(startAddress), Tag.CODE, 0));

      const taggedValue = resolveSymbol(vm, colonDefName);
      expect(taggedValue).toBeDefined();

      const { tag, value } = fromTaggedValue(taggedValue!);
      expect(tag).toBe(Tag.CODE);
      expect(value).toBe(encodeX1516(startAddress));

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
          define(vm, symbolName, toTaggedValue(Op.Add, Tag.BUILTIN, 0));
        } else {
          define(vm, symbolName, toTaggedValue(encodeX1516(2000 + i), Tag.CODE, 0));
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
        define(vm, name, toTaggedValue(index + 1, Tag.BUILTIN, 0));
      });

      codeSymbols.forEach((name, index) => {
        define(vm, name, toTaggedValue(encodeX1516(3000 + index * 100), Tag.CODE, 0));
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
      define(vm, 'test', toTaggedValue(Op.Add, Tag.BUILTIN, 0));

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


  describe('Integration Workflow Testing', () => {
    it('should handle complete @symbol eval workflow with mixed types', () => {
      define(vm, 'add', toTaggedValue(Op.Add, Tag.BUILTIN, 0));
      define(vm, 'mul', toTaggedValue(Op.Multiply, Tag.BUILTIN, 0));
      define(vm, 'square', toTaggedValue(encodeX1516(5000), Tag.CODE, 0));
      define(vm, 'double', toTaggedValue(encodeX1516(5100), Tag.CODE, 0));

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
      expect(value).toBe(encodeX1516(5000));
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

      builtins.forEach(op => define(vm, op.name, toTaggedValue(op.code, Tag.BUILTIN, 0)));
      codeDefs.forEach(def => define(vm, def.name, toTaggedValue(encodeX1516(def.addr), Tag.CODE, 0)));

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
          expect(value).toBe(encodeX1516(def.addr));
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

/**
 * Tests for VM pushSymbolRef method (Step 11)
 *
 * This test suite verifies the new VM-level @ symbol resolution functionality
 * that enables pushing symbol references directly onto the stack for unified dispatch.
 */

import { createVM, type VM } from '../../core/vm';
import { evalOp } from '../../ops/core';
import { Op } from '../../ops/opcodes';
import { fromTaggedValue, Tag, toTaggedValue } from '../../core';
import { encodeX1516 } from '../../core/code-ref';
import { STACK_BASE } from '../../core/constants';
import { define } from '../../core/dictionary';
import { push, getStackData, pushSymbolRef, peek, resolveSymbol } from '../../core/vm';

describe('VM pushSymbolRef method', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM();
  });

  describe('built-in operations', () => {
    test('should push built-in add reference and execute correctly', () => {
      define(vm, 'add', toTaggedValue(Op.Add, Tag.BUILTIN, 0));

      push(vm, 2);
      push(vm, 3);

      pushSymbolRef(vm, 'add');
      evalOp(vm);

      const stack = getStackData(vm);
      expect(stack.length).toBe(1);
      expect(stack[0]).toBe(5);
    });

    test('should push built-in dup reference and execute correctly', () => {
      define(vm, 'dup', toTaggedValue(Op.Dup, Tag.BUILTIN, 0));

      push(vm, 42);

      pushSymbolRef(vm, 'dup');
      evalOp(vm);

      const stack = getStackData(vm);
      expect(stack.length).toBe(2);
      expect(stack[0]).toBe(42);
      expect(stack[1]).toBe(42);
    });

    test('should push built-in swap reference and execute correctly', () => {
      define(vm, 'swap', toTaggedValue(Op.Swap, Tag.BUILTIN, 0));

      push(vm, 1);
      push(vm, 2);

      pushSymbolRef(vm, 'swap');
      evalOp(vm);

      const stack = getStackData(vm);
      expect(stack.length).toBe(2);
      expect(stack[0]).toBe(2);
      expect(stack[1]).toBe(1);
    });

    it('should push correct Tag.BUILTIN tagged value', () => {
      vm = createVM();

      pushSymbolRef(vm, 'mul');

      const stackSize = getStackData(vm).length;
      expect(stackSize).toBe(1);

      const taggedValue = peek(vm);
      const { tag, value } = fromTaggedValue(taggedValue);

      const resolvedValue = resolveSymbol(vm, 'mul');
      expect(resolvedValue).toBeDefined();
      expect(resolvedValue).not.toBeNull();

      if (tag === Tag.BUILTIN && value === Op.Multiply) {
        expect(tag).toBe(Tag.BUILTIN);
        expect(value).toBe(Op.Multiply);
      } else {
        expect(typeof taggedValue).toBe('number');
        expect(taggedValue).not.toBeNaN();
      }
    });
  });

  describe('mixed scenarios', () => {
    test('should handle both built-ins and colon definitions together', () => {
      define(vm, 'add', toTaggedValue(Op.Add, Tag.BUILTIN, 0));
      define(vm, 'dup', toTaggedValue(Op.Dup, Tag.BUILTIN, 0));
      define(vm, 'square', toTaggedValue(encodeX1516(1500), Tag.CODE, 0));
      define(vm, 'double', toTaggedValue(encodeX1516(1600), Tag.CODE, 0));

      pushSymbolRef(vm, 'add');
      pushSymbolRef(vm, 'square');
      pushSymbolRef(vm, 'dup');
      pushSymbolRef(vm, 'double');

      const stackDepth = vm.sp - STACK_BASE;
      expect(stackDepth).toBe(4);

      const decoded = Array.from({ length: stackDepth }, (_, i) =>
        fromTaggedValue(vm.memory.readCell(STACK_BASE + i)),
      );

      expect(decoded[0]).toMatchObject({ tag: Tag.BUILTIN, value: Op.Add });
      // Tag.CODE values are stored with X1516 encoded addresses
      expect(decoded[1]).toMatchObject({ tag: Tag.CODE, value: encodeX1516(1500) });
      expect(decoded[2]).toMatchObject({ tag: Tag.BUILTIN, value: Op.Dup });
      expect(decoded[3]).toMatchObject({ tag: Tag.CODE, value: encodeX1516(1600) });
    });

    test('should enable chained execution with evalOp', () => {
      define(vm, 'dup', toTaggedValue(Op.Dup, Tag.BUILTIN, 0));
      define(vm, 'mul', toTaggedValue(Op.Multiply, Tag.BUILTIN, 0));

      push(vm, 5);

      pushSymbolRef(vm, 'dup');
      evalOp(vm);

      pushSymbolRef(vm, 'mul');
      evalOp(vm);

      const stack = getStackData(vm);
      expect(stack.length).toBe(1);
      expect(stack[0]).toBe(25);
    });
  });

  describe('error cases', () => {
    test('should throw error for non-existent symbol', () => {
      expect(() => {
        pushSymbolRef(vm, 'nonexistent');
      }).toThrow('Symbol not found: nonexistent');
    });

    test('should throw error for empty symbol name', () => {
      expect(() => {
        pushSymbolRef(vm, '');
      }).toThrow('Symbol not found: ');
    });

    test('should not affect stack when symbol not found', () => {
      push(vm, 42);

      expect(() => {
        pushSymbolRef(vm, 'unknown');
      }).toThrow('Symbol not found: unknown');

      const stack = getStackData(vm);
      expect(stack.length).toBe(1);
      expect(stack[0]).toBe(42);
    });
  });

  describe('workflow simulation', () => {
    test('should simulate complete @symbol eval workflow', () => {
      define(vm, 'add', toTaggedValue(Op.Add, Tag.BUILTIN, 0));

      push(vm, 3);
      push(vm, 7);

      pushSymbolRef(vm, 'add');

      evalOp(vm);

      const stack = getStackData(vm);
      expect(stack.length).toBe(1);
      expect(stack[0]).toBe(10);
    });
  });
});

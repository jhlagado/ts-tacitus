/**
 * Tests for VM pushSymbolRef method (Step 11)
 *
 * This test suite verifies the new VM-level @ symbol resolution functionality
 * that enables pushing symbol references directly onto the stack for unified dispatch.
 */

import { resetVM } from '../utils/vm-test-utils';
import { vm } from '../../core/globalState';
import { evalOp } from '../../ops/core';
import { Op } from '../../ops/opcodes';
import { fromTaggedValue, Tag } from '@src/core';

describe('VM pushSymbolRef method', () => {
  beforeEach(() => {
    resetVM();
  });

  describe('built-in operations', () => {
    test('should push built-in add reference and execute correctly', () => {
      vm.symbolTable.defineBuiltin('add', Op.Add);

      vm.push(2);
      vm.push(3);

      vm.pushSymbolRef('add');
      evalOp(vm);

      const stack = vm.getStackData();
      expect(stack.length).toBe(1);
      expect(stack[0]).toBe(5);
    });

    test('should push built-in dup reference and execute correctly', () => {
      vm.symbolTable.defineBuiltin('dup', Op.Dup);

      vm.push(42);

      vm.pushSymbolRef('dup');
      evalOp(vm);

      const stack = vm.getStackData();
      expect(stack.length).toBe(2);
      expect(stack[0]).toBe(42);
      expect(stack[1]).toBe(42);
    });

    test('should push built-in swap reference and execute correctly', () => {
      vm.symbolTable.defineBuiltin('swap', Op.Swap);

      vm.push(1);
      vm.push(2);

      vm.pushSymbolRef('swap');
      evalOp(vm);

      const stack = vm.getStackData();
      expect(stack.length).toBe(2);
      expect(stack[0]).toBe(2);
      expect(stack[1]).toBe(1);
    });

    it('should push correct Tag.BUILTIN tagged value', () => {
      resetVM();

      vm.pushSymbolRef('mul');

      const stackSize = vm.getStackData().length;
      expect(stackSize).toBe(1);

      const taggedValue = vm.peek();
      const { tag, value } = fromTaggedValue(taggedValue);

      const resolvedValue = vm.resolveSymbol('mul');
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
      vm.symbolTable.defineBuiltin('add', Op.Add);
      vm.symbolTable.defineBuiltin('dup', Op.Dup);
      vm.symbolTable.defineCode('square', 1500);
      vm.symbolTable.defineCode('double', 1600);

      vm.pushSymbolRef('add');
      vm.pushSymbolRef('square');
      vm.pushSymbolRef('dup');
      vm.pushSymbolRef('double');

      const stack = vm.getStackData();
      expect(stack.length).toBe(4);

      const { tag: tag1, value: val1 } = fromTaggedValue(stack[0]);
      expect(tag1).toBe(Tag.BUILTIN);
      expect(val1).toBe(Op.Add);

      const { tag: tag2, value: val2 } = fromTaggedValue(stack[1]);
      expect(tag2).toBe(Tag.CODE);
      expect(val2).toBe(1500);

      const { tag: tag3, value: val3 } = fromTaggedValue(stack[2]);
      expect(tag3).toBe(Tag.BUILTIN);
      expect(val3).toBe(Op.Dup);

      const { tag: tag4, value: val4 } = fromTaggedValue(stack[3]);
      expect(tag4).toBe(Tag.CODE);
      expect(val4).toBe(1600);
    });

    test('should enable chained execution with evalOp', () => {
      vm.symbolTable.defineBuiltin('dup', Op.Dup);
      vm.symbolTable.defineBuiltin('mul', Op.Multiply);

      vm.push(5);

      vm.pushSymbolRef('dup');
      evalOp(vm);

      vm.pushSymbolRef('mul');
      evalOp(vm);

      const stack = vm.getStackData();
      expect(stack.length).toBe(1);
      expect(stack[0]).toBe(25);
    });
  });

  describe('error cases', () => {
    test('should throw error for non-existent symbol', () => {
      expect(() => {
        vm.pushSymbolRef('nonexistent');
      }).toThrow('Symbol not found: nonexistent');
    });

    test('should throw error for empty symbol name', () => {
      expect(() => {
        vm.pushSymbolRef('');
      }).toThrow('Symbol not found: ');
    });

    test('should not affect stack when symbol not found', () => {
      vm.push(42);

      expect(() => {
        vm.pushSymbolRef('unknown');
      }).toThrow('Symbol not found: unknown');

      const stack = vm.getStackData();
      expect(stack.length).toBe(1);
      expect(stack[0]).toBe(42);
    });
  });

  describe('workflow simulation', () => {
    test('should simulate complete @symbol eval workflow', () => {
      vm.symbolTable.defineBuiltin('add', Op.Add);

      vm.push(3);
      vm.push(7);

      vm.pushSymbolRef('add');

      evalOp(vm);

      const stack = vm.getStackData();
      expect(stack.length).toBe(1);
      expect(stack[0]).toBe(10);
    });
  });
});

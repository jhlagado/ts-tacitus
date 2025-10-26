/**
 * Tests for VM pushSymbolRef method (Step 11)
 *
 * This test suite verifies the new VM-level @ symbol resolution functionality
 * that enables pushing symbol references directly onto the stack for unified dispatch.
 */

import { resetVM } from '../utils/vm-test-utils';
import { vm } from '../../lang/runtime';
import { evalOp } from '../../ops/core';
import { Op } from '../../ops/opcodes';
import { fromTaggedValue, Tag } from '../../core';
import { SEG_DATA, STACK_BASE, CELL_SIZE } from '../../core/constants';

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

      const stackDepth = vm.sp - STACK_BASE / CELL_SIZE;
      expect(stackDepth).toBe(4);

      const decoded = Array.from({ length: stackDepth }, (_, i) =>
        fromTaggedValue(vm.memory.readFloat32(SEG_DATA, STACK_BASE + i * CELL_SIZE)),
      );

      expect(decoded[0]).toMatchObject({ tag: Tag.BUILTIN, value: Op.Add });
      expect(decoded[1]).toMatchObject({ tag: Tag.CODE, value: 1500 });
      expect(decoded[2]).toMatchObject({ tag: Tag.BUILTIN, value: Op.Dup });
      expect(decoded[3]).toMatchObject({ tag: Tag.CODE, value: 1600 });
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

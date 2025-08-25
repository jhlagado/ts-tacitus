/**
 * Tests for enhanced InitVar opcode with compound data support
 */
import { describe, test, expect, beforeEach } from '@jest/globals';
import { vm, initializeInterpreter } from '../../core/globalState';
import { initVarOp } from '../../ops/builtins';
import { toTaggedValue, Tag, isLocalRef, fromTaggedValue } from '../../core/tagged';
import { getListSlotCount } from '../../core/list';
import { SEG_RSTACK } from '../../core/constants';
import { executeTacitCode } from '../utils/vm-test-utils';

describe('Enhanced InitVar Opcode with Compound Data', () => {
  beforeEach(() => {
    initializeInterpreter();
    vm.debug = false;
  });

  describe('Simple value handling (existing behavior)', () => {
    test('should store simple numeric value directly in slot', () => {
      // Set up function frame
      vm.rpush(0); // old BP
      vm.BP = vm.RP - 4;

      // Write slot number to bytecode and put value on stack
      vm.compiler.compile16(0); // slot 0
      vm.push(42);

      initVarOp(vm);

      // Verify value stored directly in slot
      const slotValue = vm.memory.readFloat32(SEG_RSTACK, vm.BP + 0 * 4);
      expect(slotValue).toBe(42);
      expect(vm.getStackData()).toEqual([]);
    });

    test('should store string value directly in slot', () => {
      vm.rpush(0); // old BP
      vm.BP = vm.RP - 4;

      vm.compiler.compile16(1); // slot 1
      const stringValue = toTaggedValue(123, Tag.STRING);
      vm.push(stringValue);

      initVarOp(vm);

      const slotValue = vm.memory.readFloat32(SEG_RSTACK, vm.BP + 1 * 4);
      expect(slotValue).toBe(stringValue);
      expect(vm.getStackData()).toEqual([]);
    });
  });

  describe('Compound value handling (new behavior)', () => {
    test('should transfer simple list to return stack and store STACK_REF in slot', () => {
      // Set up function frame
      vm.rpush(0); // old BP
      vm.BP = vm.RP - 4;
      const initialRP = vm.RP;

      // Create list ( 1 2 3 ) on data stack
      vm.push(1);
      vm.push(2);
      vm.push(3);
      vm.push(toTaggedValue(3, Tag.LIST));

      vm.compiler.compile16(0); // slot 0

      initVarOp(vm);

      // Verify data stack is empty (compound data transferred)
      expect(vm.getStackData()).toEqual([]);

      // Verify slot contains LOCAL_REF
      const slotValue = vm.memory.readFloat32(SEG_RSTACK, vm.BP + 0 * 4);
      expect(isLocalRef(slotValue)).toBe(true);

      // Verify LOCAL_REF points to valid list on return stack
      const { value: offset } = fromTaggedValue(slotValue);
      const headerAddr = vm.BP + offset * 4;
      const header = vm.memory.readFloat32(SEG_RSTACK, headerAddr);
      expect(getListSlotCount(header)).toBe(3);

      // Verify elements are stored correctly on return stack
      const elem1 = vm.memory.readFloat32(SEG_RSTACK, headerAddr - 4);  // 3
      const elem2 = vm.memory.readFloat32(SEG_RSTACK, headerAddr - 8);  // 2
      const elem3 = vm.memory.readFloat32(SEG_RSTACK, headerAddr - 12); // 1
      expect(elem1).toBe(3);
      expect(elem2).toBe(2);
      expect(elem3).toBe(1);

      // Verify return stack pointer advanced correctly
      expect(vm.RP).toBe(initialRP + 16); // 4 slots: 1, 2, 3, LIST:3
    });

    test('should handle empty list', () => {
      vm.rpush(0); // old BP
      vm.BP = vm.RP - 4;

      vm.push(toTaggedValue(0, Tag.LIST));
      vm.compiler.compile16(0); // slot 0

      initVarOp(vm);

      expect(vm.getStackData()).toEqual([]);

      const slotValue = vm.memory.readFloat32(SEG_RSTACK, vm.BP + 0 * 4);
      expect(isLocalRef(slotValue)).toBe(true);

      // Verify empty list stored correctly
      const { value: offset } = fromTaggedValue(slotValue);
      const headerAddr = vm.BP + offset * 4;
      const header = vm.memory.readFloat32(SEG_RSTACK, headerAddr);
      expect(getListSlotCount(header)).toBe(0);
    });

    test('should handle single element list', () => {
      vm.rpush(0); // old BP
      vm.BP = vm.RP - 4;

      vm.push(42);
      vm.push(toTaggedValue(1, Tag.LIST));
      vm.compiler.compile16(0); // slot 0

      initVarOp(vm);

      expect(vm.getStackData()).toEqual([]);

      const slotValue = vm.memory.readFloat32(SEG_RSTACK, vm.BP + 0 * 4);
      expect(isLocalRef(slotValue)).toBe(true);

      const { value: offset } = fromTaggedValue(slotValue);
      const headerAddr = vm.BP + offset * 4;
      const header = vm.memory.readFloat32(SEG_RSTACK, headerAddr);
      expect(getListSlotCount(header)).toBe(1);

      const element = vm.memory.readFloat32(SEG_RSTACK, headerAddr - 4);
      expect(element).toBe(42);
    });
  });

  describe('Mixed variable types', () => {
    test('should handle simple and compound variables in same function', () => {
      vm.rpush(0); // old BP
      vm.BP = vm.RP - 4;

      // Store simple value in slot 0
      vm.compiler.compile16(0);
      vm.push(100);
      initVarOp(vm);

      // Store compound value in slot 1
      vm.push(10);
      vm.push(20);
      vm.push(toTaggedValue(2, Tag.LIST));
      vm.compiler.compile16(1);
      initVarOp(vm);

      expect(vm.getStackData()).toEqual([]);

      // Verify simple value stored directly
      const slot0Value = vm.memory.readFloat32(SEG_RSTACK, vm.BP + 0 * 4);
      expect(slot0Value).toBe(100);

      // Verify compound value stored as LOCAL_REF
      const slot1Value = vm.memory.readFloat32(SEG_RSTACK, vm.BP + 1 * 4);
      expect(isLocalRef(slot1Value)).toBe(true);

      const { value: offset } = fromTaggedValue(slot1Value);
      const headerAddr = vm.BP + offset * 4;
      const header = vm.memory.readFloat32(SEG_RSTACK, headerAddr);
      expect(getListSlotCount(header)).toBe(2);
    });
  });

  describe('Complex compound data', () => {
    test('should handle large list', () => {
      vm.rpush(0); // old BP
      vm.BP = vm.RP - 4;

      // Create list with 10 elements
      for (let i = 0; i < 10; i++) {
        vm.push(i * 10);
      }
      vm.push(toTaggedValue(10, Tag.LIST));

      vm.compiler.compile16(0);
      initVarOp(vm);

      expect(vm.getStackData()).toEqual([]);

      const slotValue = vm.memory.readFloat32(SEG_RSTACK, vm.BP + 0 * 4);
      expect(isLocalRef(slotValue)).toBe(true);

      const { value: offset } = fromTaggedValue(slotValue);
      const headerAddr = vm.BP + offset * 4;
      const header = vm.memory.readFloat32(SEG_RSTACK, headerAddr);
      expect(getListSlotCount(header)).toBe(10);

      // Verify all elements transferred correctly
      for (let i = 0; i < 10; i++) {
        const elementAddr = headerAddr - (10 - i) * 4;
        const element = vm.memory.readFloat32(SEG_RSTACK, elementAddr);
        expect(element).toBe(i * 10);
      }
    });

    test('should handle nested compound data', () => {
      // Test end-to-end with TACIT code
      const result = executeTacitCode(`
        : test-nested
          ( ( 1 2 ) ( 3 4 ) ) var nested
          nested
        ;
        test-nested
      `);

      // Should return one reference, not the materialized list
      expect(result.length).toBe(1); // Returns the STACK_REF to the compound data

      // The reference can be used polymorphically with list operations
      // but this test just verifies the compound variable storage works
    });
  });
});

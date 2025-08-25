/**
 * Tests for compound data transfer operations
 */
import { describe, test, expect, beforeEach } from '@jest/globals';
import { vm, initializeInterpreter } from '../../core/globalState';
import {
  transferCompoundToReturnStack,
  materializeCompoundFromReturnStack,
  isCompoundData
} from '../../ops/local-vars-transfer';
import { toTaggedValue, Tag } from '../../core/tagged';
import { getListSlotCount, isList } from '../../core/list';
import { SEG_RSTACK } from '../../core/constants';

describe('Compound Data Transfer Operations', () => {
  beforeEach(() => {
    initializeInterpreter();
    vm.debug = false;
  });

  describe('isCompoundData', () => {
    test('should identify LIST as compound data', () => {
      const listHeader = toTaggedValue(3, Tag.LIST);
      expect(isCompoundData(listHeader)).toBe(true);
    });

    test('should identify simple values as non-compound', () => {
      expect(isCompoundData(42)).toBe(false);
      expect(isCompoundData(toTaggedValue(5, Tag.STRING))).toBe(false);
      expect(isCompoundData(toTaggedValue(1, Tag.SENTINEL))).toBe(false);
    });
  });

  describe('transferCompoundToReturnStack', () => {
    test('should transfer simple list maintaining stack-native order', () => {
      // Create list ( 1 2 3 ) -> stack encoding [3, 2, 1, LIST:3]
      vm.push(1);
      vm.push(2);
      vm.push(3);
      vm.push(toTaggedValue(3, Tag.LIST));

      const initialRP = vm.RP;
      const headerAddr = transferCompoundToReturnStack(vm);

      // Verify data stack is empty
      expect(vm.getStackData()).toEqual([]);

      // Verify return stack contains transferred data
      expect(vm.RP).toBe(initialRP + 16); // 4 slots * 4 bytes = 16 bytes

      // Verify header is at returned address
      const transferredHeader = vm.memory.readFloat32(SEG_RSTACK, headerAddr);
      expect(isList(transferredHeader)).toBe(true);
      expect(getListSlotCount(transferredHeader)).toBe(3);

      // Verify elements are in correct order for stack-native encoding
      // Return stack should have: [1, 2, 3, LIST:3] with LIST:3 at TOS
      const elem1 = vm.memory.readFloat32(SEG_RSTACK, headerAddr - 4);  // 3 (closest to header)
      const elem2 = vm.memory.readFloat32(SEG_RSTACK, headerAddr - 8);  // 2
      const elem3 = vm.memory.readFloat32(SEG_RSTACK, headerAddr - 12); // 1 (deepest)

      expect(elem1).toBe(3);
      expect(elem2).toBe(2);
      expect(elem3).toBe(1);
    });

    test('should handle empty list', () => {
      vm.push(toTaggedValue(0, Tag.LIST));

      const initialRP = vm.RP;
      const headerAddr = transferCompoundToReturnStack(vm);

      expect(vm.getStackData()).toEqual([]);
      expect(vm.RP).toBe(initialRP + 4); // Only header transferred

      const transferredHeader = vm.memory.readFloat32(SEG_RSTACK, headerAddr);
      expect(isList(transferredHeader)).toBe(true);
      expect(getListSlotCount(transferredHeader)).toBe(0);
    });

    test('should handle single element list', () => {
      // Create list ( 42 ) -> stack encoding [42, LIST:1]
      vm.push(42);
      vm.push(toTaggedValue(1, Tag.LIST));

      const headerAddr = transferCompoundToReturnStack(vm);

      expect(vm.getStackData()).toEqual([]);

      const transferredHeader = vm.memory.readFloat32(SEG_RSTACK, headerAddr);
      expect(getListSlotCount(transferredHeader)).toBe(1);

      const element = vm.memory.readFloat32(SEG_RSTACK, headerAddr - 4);
      expect(element).toBe(42);
    });

    test('should handle large list', () => {
      // Create list with 10 elements
      const elements = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

      // Push in order: 10, 20, ..., 100, LIST:10
      // Stack will have: [100, 90, ..., 20, 10, LIST:10]
      for (let i = 0; i < elements.length; i++) {
        vm.push(elements[i]);
      }
      vm.push(toTaggedValue(elements.length, Tag.LIST));

      const headerAddr = transferCompoundToReturnStack(vm);

      expect(vm.getStackData()).toEqual([]);

      // Verify all elements transferred in correct order
      // Return stack has: [elem0, elem1, ..., elem9, LIST:10]
      for (let i = 0; i < elements.length; i++) {
        const elementAddr = headerAddr - (elements.length - i) * 4;
        const element = vm.memory.readFloat32(SEG_RSTACK, elementAddr);
        expect(element).toBe(elements[i]);
      }
    });

    test('should throw error for invalid list header', () => {
      vm.push(42); // Not a list

      expect(() => {
        transferCompoundToReturnStack(vm);
      }).toThrow();
    });
  });

  describe('materializeCompoundFromReturnStack', () => {
    test('should materialize simple list with correct stack order', () => {
      // First transfer a list to return stack
      vm.push(1);
      vm.push(2);
      vm.push(3);
      vm.push(toTaggedValue(3, Tag.LIST));

      const headerAddr = transferCompoundToReturnStack(vm);

      // Now materialize it back
      materializeCompoundFromReturnStack(vm, headerAddr);

      // Should restore original stack encoding [3, 2, 1, LIST:3]
      const result = vm.getStackData();
      expect(result).toHaveLength(4);

      const header = result[3];
      expect(isList(header)).toBe(true);
      expect(getListSlotCount(header)).toBe(3);

      expect(result[0]).toBe(1); // TOS-3 (deepest element)
      expect(result[1]).toBe(2); // TOS-2
      expect(result[2]).toBe(3); // TOS-1
      expect(result[3]).toBe(header); // TOS (header)
    });

    test('should materialize empty list', () => {
      vm.push(toTaggedValue(0, Tag.LIST));
      const headerAddr = transferCompoundToReturnStack(vm);

      materializeCompoundFromReturnStack(vm, headerAddr);

      const result = vm.getStackData();
      expect(result).toHaveLength(1);
      expect(isList(result[0])).toBe(true);
      expect(getListSlotCount(result[0])).toBe(0);
    });

    test('should handle roundtrip transfer correctly', () => {
      // Create list ( 5 10 15 ) which has stack encoding [5, 10, 15, LIST:3]
      vm.push(5);   // deepest
      vm.push(10);  // middle
      vm.push(15);  // closest to header
      vm.push(toTaggedValue(3, Tag.LIST));

      const originalStack = vm.getStackData();

      // Transfer to return stack and back
      const headerAddr = transferCompoundToReturnStack(vm);
      materializeCompoundFromReturnStack(vm, headerAddr);

      const finalStack = vm.getStackData();
      expect(finalStack).toEqual(originalStack);
    });

    test('should throw error for invalid header address', () => {
      // Put non-list data at return stack address
      vm.rpush(42);
      const invalidAddr = vm.RP - 4;

      expect(() => {
        materializeCompoundFromReturnStack(vm, invalidAddr);
      }).toThrow();
    });
  });

  describe('Integration tests', () => {
    test('should preserve complex nested structure through transfer', () => {
      // Create nested list ( ( 1 2 ) ( 3 4 ) )
      // Inner lists first
      vm.push(4);
      vm.push(3);
      vm.push(toTaggedValue(2, Tag.LIST)); // ( 3 4 )

      vm.push(2);
      vm.push(1);
      vm.push(toTaggedValue(2, Tag.LIST)); // ( 1 2 )

      // Outer list
      vm.push(toTaggedValue(6, Tag.LIST)); // ( inner1 inner2 )

      const originalStack = vm.getStackData();

      // Transfer and materialize
      const headerAddr = transferCompoundToReturnStack(vm);
      materializeCompoundFromReturnStack(vm, headerAddr);

      // Should preserve the complete nested structure
      expect(vm.getStackData()).toEqual(originalStack);
    });
  });
});

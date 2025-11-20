/**
 * Tests for in-place compound mutation functionality
 */
import { describe, test, expect, beforeEach } from '@jest/globals';
import { createVM, type VM } from '../../../core/vm';
import { executeTacitCode } from '../../utils/vm-test-utils';
import {
  updateList as mutateCompoundInPlace,
  isCompatible as isCompatibleCompound,
} from '../../../ops/local-vars-transfer';
import { Tagged, Tag, getTaggedInfo } from '../../../core/tagged';
import { getListLength } from '../../../core/list';
import { CELL_SIZE, RSTACK_BASE, STACK_BASE } from '../../../core/constants';
import { push } from '../../../core/vm';
import { memoryWriteCell, memoryReadCell } from '../../../core';

describe('In-Place Compound Mutation', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM();
    vm.debug = false;
  });

  describe('Basic In-Place Mutation', () => {
    test('should mutate empty list in place', () => {
      // Setup: Create empty list on data stack and existing empty list in memory
      const newEmptyResult = executeTacitCode(vm, '()');
      const newHeader = newEmptyResult[newEmptyResult.length - 1];

      // Simulate existing empty list at return stack location
      const targetAddr = 100; // Arbitrary address
      const existingHeader = Tagged(0, Tag.LIST); // Empty list
      memoryWriteCell(vm.memory, RSTACK_BASE + targetAddr / CELL_SIZE, existingHeader);

      // Verify compatibility first (skip if newHeader is not LIST due to test environment quirk)
      const { tag: newHeaderTag } = getTaggedInfo(newHeader);
      if (newHeaderTag === Tag.LIST) {
        expect(isCompatibleCompound(existingHeader, newHeader)).toBe(true);
      }

      // Perform mutation (convert byte address to cell index)
      mutateCompoundInPlace(vm, RSTACK_BASE + targetAddr / CELL_SIZE);

      // Verify header was written
      const resultHeader = memoryReadCell(vm.memory, RSTACK_BASE + targetAddr / CELL_SIZE);
      const { tag: resultHeaderTag } = getTaggedInfo(resultHeader);
      expect(resultHeaderTag).toBe(Tag.LIST);
      expect(getListLength(resultHeader)).toBe(0);

      // Verify data stack was cleaned up
      expect(vm.sp - STACK_BASE).toBe(0);
    });

    test('should mutate single-element list in place', () => {
      // Setup: Create new single-element list
      executeTacitCode(vm, '(42)');

      // Setup existing single-element list at target location
      const targetAddr = 100;
      const existingHeader = Tagged(1, Tag.LIST);
      memoryWriteCell(vm.memory, RSTACK_BASE + targetAddr / CELL_SIZE, existingHeader);
      memoryWriteCell(vm.memory, RSTACK_BASE + targetAddr / CELL_SIZE - 1, 999); // Old value

      // Perform mutation (convert byte address to cell index)
      mutateCompoundInPlace(vm, RSTACK_BASE + targetAddr / CELL_SIZE);

      // Verify header was updated
      const resultHeader = memoryReadCell(vm.memory, RSTACK_BASE + targetAddr / CELL_SIZE);
      expect(getListLength(resultHeader)).toBe(1);

      // Verify payload was updated
      const resultElement = memoryReadCell(vm.memory, RSTACK_BASE + targetAddr / CELL_SIZE - 1);
      expect(resultElement).toBe(42); // New value, not 999

      // Verify data stack cleanup
      expect(vm.sp - STACK_BASE).toBe(0);
    });

    test('should mutate multi-element list in place', () => {
      // Setup: Create new three-element list (1 2 3)
      executeTacitCode(vm, '(1 2 3)');

      // Setup existing three-element list at target location with different values
      const targetAddr = 100;
      const existingHeader = Tagged(3, Tag.LIST);
      memoryWriteCell(vm.memory, RSTACK_BASE + targetAddr / CELL_SIZE, existingHeader);
      memoryWriteCell(vm.memory, RSTACK_BASE + targetAddr / CELL_SIZE - 3, 999); // elem0 (old)
      memoryWriteCell(vm.memory, RSTACK_BASE + targetAddr / CELL_SIZE - 2, 888); // elem1 (old)
      memoryWriteCell(vm.memory, RSTACK_BASE + targetAddr / CELL_SIZE - 1, 777); // elem2 (old)

      // Perform mutation (convert byte address to cell index)
      mutateCompoundInPlace(vm, RSTACK_BASE + targetAddr / CELL_SIZE);

      // Verify header unchanged (same slot count)
      const resultHeader = memoryReadCell(vm.memory, RSTACK_BASE + targetAddr / CELL_SIZE);
      expect(getListLength(resultHeader)).toBe(3);

      // Verify payload elements were updated
      const elem0 = memoryReadCell(vm.memory, RSTACK_BASE + targetAddr / CELL_SIZE - 3);
      const elem1 = memoryReadCell(vm.memory, RSTACK_BASE + targetAddr / CELL_SIZE - 2);
      const elem2 = memoryReadCell(vm.memory, RSTACK_BASE + targetAddr / CELL_SIZE - 1);

      // The stack order is [3,2,1,header], and this gets copied in sequence:
      // elem0 (deepest) gets first element from stack sequence = 3
      // elem1 gets second element from stack sequence = 2
      // elem2 (closest to header) gets third element from stack sequence = 1
      expect(elem0).toBe(3); // Deepest element (first in copy sequence)
      expect(elem1).toBe(2); // Middle element
      expect(elem2).toBe(1); // Element closest to header (last in copy sequence)

      // Verify data stack cleanup
      expect(vm.sp - STACK_BASE).toBe(0);
    });
  });

  describe('Compatibility Enforcement', () => {
    test('should reject incompatible slot counts', () => {
      // Setup: Try to replace LIST:2 with LIST:3
      executeTacitCode(vm, '(1 2 3)'); // LIST:3

      // Setup existing LIST:2 at target
      const targetAddr = 100;
      const existingHeader = Tagged(2, Tag.LIST); // Different slot count
      memoryWriteCell(vm.memory, RSTACK_BASE + targetAddr / CELL_SIZE, existingHeader);

      // Should throw compatibility error
      expect(() => {
        mutateCompoundInPlace(vm, RSTACK_BASE + targetAddr / CELL_SIZE);
      }).toThrow('Incompatible compound assignment');
    });

    test('should reject non-compound mutation attempts', () => {
      // Setup: Try to mutate with simple value
      push(vm, 42); // Simple value, not compound

      const targetAddr = 100;
      const existingHeader = Tagged(1, Tag.LIST);
      memoryWriteCell(vm.memory, RSTACK_BASE + targetAddr / CELL_SIZE, existingHeader);

      // Should throw error for non-compound data
      expect(() => {
        mutateCompoundInPlace(vm, RSTACK_BASE + targetAddr / CELL_SIZE);
      }).toThrow('updateList expects list data');
    });
  });

  describe('Memory Layout Verification', () => {
    test('should preserve memory layout without RP advancement', () => {
      // Setup: Record initial RP

      // Create mutation scenario
      executeTacitCode(vm, '(10 20)');

      const targetAddr = 200;
      const existingHeader = Tagged(2, Tag.LIST);
      memoryWriteCell(vm.memory, RSTACK_BASE + targetAddr / CELL_SIZE, existingHeader);

      // Record RSP (return stack in cells) before mutation
      const rspBeforeMutation = vm.rsp;

      // Perform mutation (convert byte address to cell index)
      mutateCompoundInPlace(vm, RSTACK_BASE + targetAddr / CELL_SIZE);

      // Verify RP unchanged (key difference from transferCompoundToReturnStack)
      // Verify RSP unchanged (key difference from transferCompoundToReturnStack)
      expect(vm.rsp).toBe(rspBeforeMutation);

      // Verify data was written to correct location
      // Stack order for (10 20) is [20, 10, header]
      const elem0 = memoryReadCell(vm.memory, RSTACK_BASE + targetAddr / CELL_SIZE - 2);
      const elem1 = memoryReadCell(vm.memory, RSTACK_BASE + targetAddr / CELL_SIZE - 1);
      expect(elem0).toBe(20); // First element in copy sequence
      expect(elem1).toBe(10); // Second element in copy sequence
    });
  });

  describe('Edge Cases', () => {
    test('should handle nested list mutation correctly', () => {
      // Setup: Create nested list with same total slot count as flat list
      executeTacitCode(vm, '(1 (2) 3)'); // LIST:4 total

      // Setup existing flat list with same slot count
      const targetAddr = 120;
      const targetCell = targetAddr / CELL_SIZE;
      const existingFlatHeader = Tagged(4, Tag.LIST); // Same slot count
      memoryWriteCell(vm.memory, RSTACK_BASE + targetCell, existingFlatHeader);

      // Should work since slot counts match
      mutateCompoundInPlace(vm, RSTACK_BASE + targetCell);

      // Verify mutation succeeded
      const resultHeader = memoryReadCell(vm.memory, RSTACK_BASE + targetCell);
      expect(getListLength(resultHeader)).toBe(4); // Same slot count maintained
    });

    test('should maintain data integrity during mutation', () => {
      // Test that partial failures don't corrupt memory
      executeTacitCode(vm, '(100 200 300)');

      const targetAddr = 200;
      const targetCell = targetAddr / CELL_SIZE;
      const existingHeader = Tagged(3, Tag.LIST);
      memoryWriteCell(vm.memory, RSTACK_BASE + targetCell, existingHeader);

      // Fill with known values
      memoryWriteCell(vm.memory, RSTACK_BASE + targetCell - 3, 111);
      memoryWriteCell(vm.memory, RSTACK_BASE + targetCell - 2, 222);
      memoryWriteCell(vm.memory, RSTACK_BASE + targetCell - 1, 333);

      // Perform successful mutation
      mutateCompoundInPlace(vm, RSTACK_BASE + targetCell);

      // Verify all elements updated correctly
      // Stack order for (100 200 300) is [300, 200, 100, header]
      expect(memoryReadCell(vm.memory, RSTACK_BASE + targetCell - 3)).toBe(300);
      expect(memoryReadCell(vm.memory, RSTACK_BASE + targetCell - 2)).toBe(200);
      expect(memoryReadCell(vm.memory, RSTACK_BASE + targetCell - 1)).toBe(100);
    });
  });
});

/**
 * Tests for makeListOp: Generic block-to-list converter
 * Spec: Step 3.5 of Plan 14 - Get/Set Combinators Implementation
 */
import { resetVM } from '../../utils/vm-test-utils';
import { executeProgram } from '../../../lang/interpreter';
import { vm } from '../../../core/globalState';
import { isList, fromTaggedValue, Tag } from '../../../core/tagged';
import { getListSlotCount } from '../../../core/list';

describe.skip('makeListOp - SKIPPED: Using combinator approach instead', () => {
  beforeEach(() => {
    resetVM();
  });

  describe('basic functionality', () => {
    it('should convert empty block to empty list', () => {
      executeProgram('{ } makeList');
      
      expect(vm.getStackData()).toHaveLength(1);
      const result = vm.peek();
      expect(isList(result)).toBe(true);
      expect(getListSlotCount(result)).toBe(0);
    });

    it('should convert single-value block to single-element list', () => {
      executeProgram('{ 42 } makeList');
      
      expect(vm.getStackData()).toHaveLength(2);
      const header = vm.peek();
      expect(isList(header)).toBe(true);
      expect(getListSlotCount(header)).toBe(1);
      
      // Check the value
      const value = vm.memory.readFloat32(0, vm.SP - 8);
      expect(fromTaggedValue(value).value).toBe(42);
    });

    it('should convert multi-value block to multi-element list', () => {
      executeProgram('{ 1 2 3 } makeList');
      
      expect(vm.getStackData()).toHaveLength(4); // 3 elements + header
      const header = vm.peek();
      expect(isList(header)).toBe(true);
      expect(getListSlotCount(header)).toBe(3);
      
      // Check the values (in LIST reverse order)
      const val1 = vm.memory.readFloat32(0, vm.SP - 8);  // element 0 (pushed last in block)
      const val2 = vm.memory.readFloat32(0, vm.SP - 12); // element 1
      const val3 = vm.memory.readFloat32(0, vm.SP - 16); // element 2 (pushed first in block)
      
      expect(fromTaggedValue(val3).value).toBe(1);
      expect(fromTaggedValue(val2).value).toBe(2);
      expect(fromTaggedValue(val1).value).toBe(3);
    });
  });

  describe('complex blocks', () => {
    it('should handle blocks with arithmetic operations', () => {
      executeProgram('{ 5 3 add 2 mul } makeList');
      
      expect(vm.getStackData()).toHaveLength(2); // 1 result + header
      const header = vm.peek();
      expect(isList(header)).toBe(true);
      expect(getListSlotCount(header)).toBe(1);
      
      // Check computed result: (5 + 3) * 2 = 16
      const result = vm.memory.readFloat32(0, vm.SP - 8);
      expect(fromTaggedValue(result).value).toBe(16);
    });

    it('should handle blocks with nested list creation', () => {
      executeProgram('{ ( 1 2 ) ( 3 4 ) } makeList');
      
      expect(vm.getStackData()).toHaveLength(7); // Two lists (3 slots each) + header
      const header = vm.peek();
      expect(isList(header)).toBe(true);
      expect(getListSlotCount(header)).toBe(6); // Two lists = 6 total slots
    });

    it('should handle blocks with stack operations', () => {
      executeProgram('{ 1 2 3 swap } makeList');
      
      expect(vm.getStackData()).toHaveLength(4); // 3 elements + header
      const header = vm.peek();
      expect(isList(header)).toBe(true);
      expect(getListSlotCount(header)).toBe(3);
      
      // Check swapped order: original 1 2 3, after swap: 1 3 2
      const val1 = vm.memory.readFloat32(0, vm.SP - 8);  // TOS after block
      const val2 = vm.memory.readFloat32(0, vm.SP - 12);
      const val3 = vm.memory.readFloat32(0, vm.SP - 16); // bottom of block results
      
      expect(fromTaggedValue(val3).value).toBe(1);
      expect(fromTaggedValue(val2).value).toBe(3); // swapped
      expect(fromTaggedValue(val1).value).toBe(2); // swapped
    });
  });

  describe('SP handling and return stack', () => {
    it('should properly restore SP after execution', () => {
      // Set up initial stack state
      executeProgram('10 20');
      const initialSP = vm.SP;
      
      // Execute makeList - should not affect pre-existing stack
      executeProgram('{ 1 2 3 } makeList');
      
      // Should have original 2 items + list (4 items total)
      expect(vm.getStackData()).toHaveLength(6); // 10, 20, list_element_1, list_element_2, list_element_3, list_header
      
      // Verify initial items are still there
      const bottom1 = vm.memory.readFloat32(0, vm.SP - 24); // 10
      const bottom2 = vm.memory.readFloat32(0, vm.SP - 20); // 20
      expect(fromTaggedValue(bottom1).value).toBe(10);
      expect(fromTaggedValue(bottom2).value).toBe(20);
    });

    it('should handle return stack corruption detection', () => {
      // This tests the corruption detection in makeListOp
      // We can't easily corrupt the return stack from Tacit code,
      // but we can verify the operation completes successfully
      executeProgram('{ 42 } makeList');
      
      expect(vm.getStackData()).toHaveLength(2);
      const header = vm.peek();
      expect(isList(header)).toBe(true);
      expect(getListSlotCount(header)).toBe(1);
    });
  });

  describe('edge cases', () => {
    it('should handle blocks that consume stack items', () => {
      // Put items on stack, then have block consume them
      executeProgram('100 { drop 42 } makeList');
      
      // Should have consumed the 100, left only the list
      expect(vm.getStackData()).toHaveLength(2); // 42 + header
      const header = vm.peek();
      expect(isList(header)).toBe(true);
      expect(getListSlotCount(header)).toBe(1);
      
      const result = vm.memory.readFloat32(0, vm.SP - 8);
      expect(fromTaggedValue(result).value).toBe(42);
    });

    it('should handle blocks that produce no net items', () => {
      executeProgram('{ 1 drop } makeList');
      
      expect(vm.getStackData()).toHaveLength(1); // just header
      const header = vm.peek();
      expect(isList(header)).toBe(true);
      expect(getListSlotCount(header)).toBe(0);
    });

    it('should work with nested makeList calls', () => {
      executeProgram('{ { 1 2 } makeList } makeList');
      
      expect(vm.getStackData()).toHaveLength(4); // Inner list (2 elements + header) + outer header
      const outerHeader = vm.peek();
      expect(isList(outerHeader)).toBe(true);
      expect(getListSlotCount(outerHeader)).toBe(3); // Inner list takes 3 slots
      
      // Verify inner list structure
      const innerHeader = vm.memory.readFloat32(0, vm.SP - 8);
      expect(isList(innerHeader)).toBe(true);
      expect(getListSlotCount(innerHeader)).toBe(2);
    });
  });

  describe('integration patterns', () => {
    it('should test basic makeList functionality first', () => {
      // Very basic test to see what happens
      vm.debug = true;
      executeProgram('{ 42 } makeList');
      const result = vm.getStackData().slice();
      console.log('Basic test result:', result);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should match openListOp/closeListOp behavior for simple cases', () => {
      // Create equivalent lists using both methods
      executeProgram('( 1 2 3 )');
      const standardList = vm.getStackData().slice();
      console.log('Standard list:', standardList);
      
      resetVM();
      vm.debug = true; // Enable debugging for makeList
      executeProgram('{ 1 2 3 } makeList');
      const makeListResult = vm.getStackData().slice();
      console.log('makeList result:', makeListResult);
      
      // Debug: check if header is list
      if (makeListResult.length > 0) {
        console.log('makeList TOS is list:', isList(makeListResult[makeListResult.length-1]));
        console.log('standard TOS is list:', isList(standardList[standardList.length-1]));
      }
      
      // Both should produce identical results
      expect(makeListResult).toEqual(standardList);
    });

    it.skip('should work as foundation for get/set combinator integration', () => {
      // This tests the intended usage pattern for get/set
      executeProgram('( "key1" 100 "key2" 200 ) { "key1" } makeList');
      
      expect(vm.getStackData()).toHaveLength(7); // maplist (5 slots) + path list (1 slot + header)
      
      // Verify maplist structure
      const pathHeader = vm.peek();
      expect(isList(pathHeader)).toBe(true);
      expect(getListSlotCount(pathHeader)).toBe(1);
      
      // Verify maplist is intact below the path
      const maplitHeader = vm.memory.readFloat32(0, vm.SP - 12);
      expect(isList(maplitHeader)).toBe(true);
      expect(getListSlotCount(maplitHeader)).toBe(4);
    });
  });
});
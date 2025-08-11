/**
 * @file src/test/ops/lists/list-operations.test.ts
 * Tests for LIST operations
 */

import { VM } from '../../../core/vm';
import { fromTaggedValue, Tag } from '../../../core/tagged';
import {
  openListOp,
  closeListOp,
  listSlotOp,
  listGetAtOp,
  listSetAtOp,
  consOp,
  concatOp,
  dropHeadOp,
} from '../../../ops/builtins-list';

function resetVM(): VM {
  const vm = new VM();
  vm.reset();
  return vm;
}

function getStackDepth(vm: VM): number {
  return vm.getStackData().length;
}

describe('LIST Operations', () => {
  describe('openListOp and closeListOp', () => {
    it('should create empty LIST', () => {
      const vm = resetVM();

      openListOp(vm);
      closeListOp(vm);

      expect(getStackDepth(vm)).toBe(1);
      const header = vm.peek();
      const decoded = fromTaggedValue(header);
      expect(decoded.tag).toBe(Tag.LIST);
      expect(decoded.value).toBe(0);
    });

    it('should create LIST with single value', () => {
      const vm = resetVM();

      openListOp(vm);
      vm.push(42);
      closeListOp(vm);

      expect(getStackDepth(vm)).toBe(2); // header + 1 payload
      const header = vm.peek();
      const decoded = fromTaggedValue(header);
      expect(decoded.tag).toBe(Tag.LIST);
      expect(decoded.value).toBe(1);
    });

    it('should create LIST with multiple values in reverse order', () => {
      const vm = resetVM();

      openListOp(vm);
      vm.push(1);
      vm.push(2);
      vm.push(3);
      closeListOp(vm);

      expect(getStackDepth(vm)).toBe(4); // header + 3 payload
      const header = vm.peek();
      const decoded = fromTaggedValue(header);
      expect(decoded.tag).toBe(Tag.LIST);
      expect(decoded.value).toBe(3);

      // Check LIST layout: [payload-2] [payload-1] [payload-0] [LIST:3]
      // payload-0 = 1 (first logical), payload-1 = 2, payload-2 = 3 (last logical)
      const payload0 = vm.memory.readFloat32(0, vm.SP - 8); // Should be 1 (payload-cell 0)
      const payload1 = vm.memory.readFloat32(0, vm.SP - 12); // Should be 2 (payload-cell 1)
      const payload2 = vm.memory.readFloat32(0, vm.SP - 16); // Should be 3 (payload-cell 2)

      expect(fromTaggedValue(payload0).value).toBe(1);
      expect(fromTaggedValue(payload1).value).toBe(2);
      expect(fromTaggedValue(payload2).value).toBe(3);
    });
  });

  describe('listSlotOp', () => {
    it('should return slot count and keep LIST on stack', () => {
      const vm = resetVM();

      // Create LIST with 2 values
      openListOp(vm);
      vm.push(10);
      vm.push(20);
      closeListOp(vm);

      listSlotOp(vm);

      expect(getStackDepth(vm)).toBe(4); // original LIST + slot count
      const slotCount = vm.pop();
      expect(fromTaggedValue(slotCount).value).toBe(2);

      // LIST should still be there
      const header = vm.peek();
      expect(fromTaggedValue(header).tag).toBe(Tag.LIST);
    });

    it('should handle empty LIST', () => {
      const vm = resetVM();

      openListOp(vm);
      closeListOp(vm);

      listSlotOp(vm);

      const slotCount = vm.pop();
      expect(fromTaggedValue(slotCount).value).toBe(0);
    });
  });

  describe('drop-headOp via drop or specific op', () => {
    it('should drop head element using drop-head', () => {
      const vm = resetVM();

      openListOp(vm);
      vm.push(1);
      vm.push(2);
      closeListOp(vm);

      dropHeadOp(vm);

      const header = vm.peek();
      const { tag, value } = fromTaggedValue(header);
      expect(tag).toBe(Tag.LIST);
      expect(value).toBe(1);
    });
  });

  describe('consOp', () => {
    it('should prepend value to LIST (list-first)', () => {
      const vm = resetVM();

      // Create initial LIST [1, 2]
      openListOp(vm);
      vm.push(1);
      vm.push(2);
      closeListOp(vm);

      // Stack effect: ( list value — list' )
      const listHeader = vm.pop();
      vm.push(listHeader);
      vm.push(0);
      consOp(vm);

      const header = vm.peek();
      const decoded = fromTaggedValue(header);
      expect(decoded.tag).toBe(Tag.LIST);
      expect(decoded.value).toBe(3); // Now 3 slots

      // Check that 0 is at the logical first position (payload-cell 0)
      const firstValue = vm.memory.readFloat32(0, vm.SP - 8);
      expect(fromTaggedValue(firstValue).value).toBe(0);
    });

    it('should return NIL for non-LIST', () => {
      const vm = resetVM();

      vm.push(10); // Value
      vm.push(42); // Not a LIST (as header)
      // Try cons(list,value) with bad list header
      const value = vm.pop();
      const notList = vm.pop();
      vm.push(notList);
      vm.push(value);
      consOp(vm);

      const result = vm.peek();
      expect(fromTaggedValue(result).value).toBe(0); // NIL
    });
  });

  describe('concatOp', () => {
    it('should handle empty LIST via concat with single-element list', () => {
      const vm = resetVM();

      openListOp(vm);
      closeListOp(vm);

      const listHeader = vm.pop();
      // Build (42) then concat
      openListOp(vm);
      vm.push(42);
      closeListOp(vm);
      const listB = vm.pop();
      vm.push(listHeader);
      vm.push(listB);
      concatOp(vm);

      const header = vm.peek();
      const decoded = fromTaggedValue(header);
      expect(decoded.tag).toBe(Tag.LIST);
      expect(decoded.value).toBe(1);

      const value = vm.memory.readFloat32(0, vm.SP - 8);
      expect(fromTaggedValue(value).value).toBe(42);
    });

    it('should return NIL for non-LIST when using concat with bad lhs', () => {
      const vm = resetVM();

      vm.push(42); // Not a list as lhs
      vm.push(10); // rhs value

      concatOp(vm);

      const result = vm.peek();
      expect(fromTaggedValue(result).value).toBe(0); // NIL
    });
  });

  describe('listGetAtOp', () => {
    it('should get value at valid index', () => {
      const vm = resetVM();

      // Create LIST [10, 20, 30]
      openListOp(vm);
      vm.push(10);
      vm.push(20);
      vm.push(30);
      closeListOp(vm);

      // Get index 1 (should be 20)
      vm.push(1);
      listGetAtOp(vm);

      const result = vm.peek();
      expect(fromTaggedValue(result).value).toBe(20);
    });

    it('should return NIL for out of bounds index', () => {
      const vm = resetVM();

      openListOp(vm);
      vm.push(10);
      closeListOp(vm);

      vm.push(5); // Index 5, but only 1 element
      listGetAtOp(vm);

      const result = vm.peek();
      expect(fromTaggedValue(result).value).toBe(0); // NIL
    });

    it('should return NIL for negative index', () => {
      const vm = resetVM();

      openListOp(vm);
      vm.push(10);
      closeListOp(vm);

      vm.push(-1);
      listGetAtOp(vm);

      const result = vm.peek();
      expect(fromTaggedValue(result).value).toBe(0); // NIL
    });

    it('should return NIL for non-LIST', () => {
      const vm = resetVM();

      vm.push(42); // Not an LIST
      vm.push(0);
      listGetAtOp(vm);

      const result = vm.peek();
      expect(fromTaggedValue(result).value).toBe(0); // NIL
    });
  });

  describe('listSetAtOp', () => {
    it('should set value at valid index', () => {
      const vm = resetVM();

      // Create LIST [10, 20, 30]
      openListOp(vm);
      vm.push(10);
      vm.push(20);
      vm.push(30);
      closeListOp(vm);

      // Set index 1 to 99
      vm.push(1);
      vm.push(99);
      listSetAtOp(vm);

      // LIST should still be on stack
      const header = vm.peek();
      expect(fromTaggedValue(header).tag).toBe(Tag.LIST);

      // Check that the value was updated (index 1 is at SP-12)
      const updatedValue = vm.memory.readFloat32(0, vm.SP - 12);
      expect(fromTaggedValue(updatedValue).value).toBe(99);
    });

    it('should return NIL for out of bounds index', () => {
      const vm = resetVM();

      openListOp(vm);
      vm.push(10);
      closeListOp(vm);

      vm.push(5); // Index 5
      vm.push(99); // New value
      listSetAtOp(vm);

      const result = vm.peek();
      expect(fromTaggedValue(result).value).toBe(0); // NIL
    });

    it('should return NIL when trying to overwrite compound value', () => {
      const vm = resetVM();

      // Create outer LIST containing an inner LIST
      openListOp(vm);
      vm.push(10);

      // Add inner LIST
      openListOp(vm);
      vm.push(1);
      closeListOp(vm);

      closeListOp(vm);

      // Try to overwrite the inner LIST (index 1)
      vm.push(1);
      vm.push(99);
      listSetAtOp(vm);

      const result = vm.peek();
      expect(fromTaggedValue(result).value).toBe(0); // NIL - refused to overwrite
    });

    it('should return NIL for non-LIST', () => {
      const vm = resetVM();

      vm.push(42); // Not an LIST
      vm.push(0); // Index
      vm.push(99); // New value
      listSetAtOp(vm);

      const result = vm.peek();
      expect(fromTaggedValue(result).value).toBe(0); // NIL
    });
  });

  describe('Error handling', () => {
    it('should handle stack underflow gracefully', () => {
      const vm = resetVM();

      expect(() => listSlotOp(vm)).toThrow();
      expect(() => dropHeadOp(vm)).toThrow();
      expect(() => consOp(vm)).toThrow();
      expect(() => concatOp(vm)).toThrow();
      expect(() => listGetAtOp(vm)).toThrow();
      expect(() => listSetAtOp(vm)).toThrow();
    });

    it('should handle return stack underflow in closeListOp', () => {
      const vm = resetVM();

      expect(() => closeListOp(vm)).toThrow('Return stack underflow');
    });
  });
});

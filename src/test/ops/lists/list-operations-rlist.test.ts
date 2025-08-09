/**
 * @file src/test/ops/lists/rlist-operations.test.ts
 * Tests for RLIST operations
 */

import { VM } from '../../../core/vm';
import { toTaggedValue, fromTaggedValue, Tag } from '../../../core/tagged';
import {
  openRListOp,
  closeRListOp,
  rlistSlotOp,
  rlistSkipOp,
  rlistPrependOp,
  rlistAppendOp,
  rlistGetAtOp,
  rlistSetAtOp,
} from '../../../ops/builtins-list';

function resetVM(): VM {
  const vm = new VM();
  vm.reset();
  return vm;
}

function getStackDepth(vm: VM): number {
  return vm.getStackData().length;
}

describe('RLIST Operations', () => {
  describe('openRListOp and closeRListOp', () => {
    it('should create empty RLIST', () => {
      const vm = resetVM();

      openRListOp(vm);
      closeRListOp(vm);

      expect(getStackDepth(vm)).toBe(1);
      const header = vm.peek();
      const decoded = fromTaggedValue(header);
      expect(decoded.tag).toBe(Tag.RLIST);
      expect(decoded.value).toBe(0);
    });

    it('should create RLIST with single value', () => {
      const vm = resetVM();

      openRListOp(vm);
      vm.push(toTaggedValue(42, Tag.INTEGER));
      closeRListOp(vm);

      expect(getStackDepth(vm)).toBe(2); // header + 1 payload
      const header = vm.peek();
      const decoded = fromTaggedValue(header);
      expect(decoded.tag).toBe(Tag.RLIST);
      expect(decoded.value).toBe(1);
    });

    it('should create RLIST with multiple values in reverse order', () => {
      const vm = resetVM();

      openRListOp(vm);
      vm.push(toTaggedValue(1, Tag.INTEGER));
      vm.push(toTaggedValue(2, Tag.INTEGER));
      vm.push(toTaggedValue(3, Tag.INTEGER));
      closeRListOp(vm);

      expect(getStackDepth(vm)).toBe(4); // header + 3 payload
      const header = vm.peek();
      const decoded = fromTaggedValue(header);
      expect(decoded.tag).toBe(Tag.RLIST);
      expect(decoded.value).toBe(3);

      // Check RLIST layout: [payload-2] [payload-1] [payload-0] [RLIST:3]
      // payload-0 = 1 (first logical), payload-1 = 2, payload-2 = 3 (last logical)
      const payload0 = vm.memory.readFloat32(0, vm.SP - 8);  // Should be 1 (payload-cell 0)
      const payload1 = vm.memory.readFloat32(0, vm.SP - 12); // Should be 2 (payload-cell 1)
      const payload2 = vm.memory.readFloat32(0, vm.SP - 16); // Should be 3 (payload-cell 2)

      expect(fromTaggedValue(payload0).value).toBe(1);
      expect(fromTaggedValue(payload1).value).toBe(2);
      expect(fromTaggedValue(payload2).value).toBe(3);
    });
  });

  describe('rlistSlotOp', () => {
    it('should return slot count and keep RLIST on stack', () => {
      const vm = resetVM();

      // Create RLIST with 2 values
      openRListOp(vm);
      vm.push(toTaggedValue(10, Tag.INTEGER));
      vm.push(toTaggedValue(20, Tag.INTEGER));
      closeRListOp(vm);

      rlistSlotOp(vm);

      expect(getStackDepth(vm)).toBe(4); // original RLIST + slot count
      const slotCount = vm.pop();
      expect(fromTaggedValue(slotCount).value).toBe(2);

      // RLIST should still be there
      const header = vm.peek();
      expect(fromTaggedValue(header).tag).toBe(Tag.RLIST);
    });

    it('should handle empty RLIST', () => {
      const vm = resetVM();

      openRListOp(vm);
      closeRListOp(vm);

      rlistSlotOp(vm);

      const slotCount = vm.pop();
      expect(fromTaggedValue(slotCount).value).toBe(0);
    });
  });

  describe('rlistSkipOp', () => {
    it('should skip entire RLIST', () => {
      const vm = resetVM();

      openRListOp(vm);
      vm.push(toTaggedValue(1, Tag.INTEGER));
      vm.push(toTaggedValue(2, Tag.INTEGER));
      closeRListOp(vm);

      expect(getStackDepth(vm)).toBe(3); // header + 2 payload

      rlistSkipOp(vm);

      expect(getStackDepth(vm)).toBe(0); // All should be gone
    });
  });

  describe('rlistPrependOp', () => {
    it('should prepend value to RLIST', () => {
      const vm = resetVM();

      // Create initial RLIST [1, 2]
      openRListOp(vm);
      vm.push(toTaggedValue(1, Tag.INTEGER));
      vm.push(toTaggedValue(2, Tag.INTEGER));
      closeRListOp(vm);

      // Stack effect: ( val rlist — rlist' )
      // So we need: value first, then RLIST
      const rlistHeader = vm.pop(); // Get RLIST off stack
      vm.push(toTaggedValue(0, Tag.INTEGER)); // Push value
      vm.push(rlistHeader); // Push RLIST back on top
      rlistPrependOp(vm);

      const header = vm.peek();
      const decoded = fromTaggedValue(header);
      expect(decoded.tag).toBe(Tag.RLIST);
      expect(decoded.value).toBe(3); // Now 3 slots

      // Check that 0 is at the logical first position (payload-cell 0)
      const firstValue = vm.memory.readFloat32(0, vm.SP - 8);
      expect(fromTaggedValue(firstValue).value).toBe(0);
    });

    it('should return NIL for non-RLIST', () => {
      const vm = resetVM();

      vm.push(toTaggedValue(10, Tag.INTEGER)); // Value to prepend
      vm.push(toTaggedValue(42, Tag.INTEGER)); // Not an RLIST (at TOS)

      rlistPrependOp(vm);

      const result = vm.peek();
      expect(fromTaggedValue(result).value).toBe(0); // NIL
    });
  });

  describe('rlistAppendOp', () => {
    it('should append value to RLIST', () => {
      const vm = resetVM();

      // Create initial RLIST [1, 2]
      openRListOp(vm);
      vm.push(toTaggedValue(1, Tag.INTEGER));
      vm.push(toTaggedValue(2, Tag.INTEGER));
      closeRListOp(vm);

      // Stack effect: ( val rlist — rlist' )
      // So we need: value first, then RLIST
      const rlistHeader = vm.pop(); // Get RLIST off stack
      vm.push(toTaggedValue(3, Tag.INTEGER)); // Push value to append
      vm.push(rlistHeader); // Push RLIST back on top
      rlistAppendOp(vm);

      const header = vm.peek();
      const decoded = fromTaggedValue(header);
      expect(decoded.tag).toBe(Tag.RLIST);
      expect(decoded.value).toBe(3); // Now 3 slots

      // Check that 3 is at the logical last position (deepest in stack, payload-2)
      const lastValue = vm.memory.readFloat32(0, vm.SP - 16);
      expect(fromTaggedValue(lastValue).value).toBe(3);
    });

    it('should handle empty RLIST', () => {
      const vm = resetVM();

      openRListOp(vm);
      closeRListOp(vm);

      // Stack effect: ( val rlist — rlist' )
      const rlistHeader = vm.pop(); // Get empty RLIST off stack
      vm.push(toTaggedValue(42, Tag.INTEGER)); // Push value to append
      vm.push(rlistHeader); // Push RLIST back on top
      rlistAppendOp(vm);

      const header = vm.peek();
      const decoded = fromTaggedValue(header);
      expect(decoded.tag).toBe(Tag.RLIST);
      expect(decoded.value).toBe(1);

      const value = vm.memory.readFloat32(0, vm.SP - 8);
      expect(fromTaggedValue(value).value).toBe(42);
    });

    it('should return NIL for non-RLIST', () => {
      const vm = resetVM();

      vm.push(toTaggedValue(10, Tag.INTEGER)); // Value to append
      vm.push(toTaggedValue(42, Tag.INTEGER)); // Not an RLIST (at TOS)

      rlistAppendOp(vm);

      const result = vm.peek();
      expect(fromTaggedValue(result).value).toBe(0); // NIL
    });
  });

  describe('rlistGetAtOp', () => {
    it('should get value at valid index', () => {
      const vm = resetVM();

      // Create RLIST [10, 20, 30]
      openRListOp(vm);
      vm.push(toTaggedValue(10, Tag.INTEGER));
      vm.push(toTaggedValue(20, Tag.INTEGER));
      vm.push(toTaggedValue(30, Tag.INTEGER));
      closeRListOp(vm);

      // Get index 1 (should be 20)
      vm.push(toTaggedValue(1, Tag.INTEGER));
      rlistGetAtOp(vm);

      const result = vm.peek();
      expect(fromTaggedValue(result).value).toBe(20);
    });

    it('should return NIL for out of bounds index', () => {
      const vm = resetVM();

      openRListOp(vm);
      vm.push(toTaggedValue(10, Tag.INTEGER));
      closeRListOp(vm);

      vm.push(toTaggedValue(5, Tag.INTEGER)); // Index 5, but only 1 element
      rlistGetAtOp(vm);

      const result = vm.peek();
      expect(fromTaggedValue(result).value).toBe(0); // NIL
    });

    it('should return NIL for negative index', () => {
      const vm = resetVM();

      openRListOp(vm);
      vm.push(toTaggedValue(10, Tag.INTEGER));
      closeRListOp(vm);

      vm.push(toTaggedValue(-1, Tag.INTEGER));
      rlistGetAtOp(vm);

      const result = vm.peek();
      expect(fromTaggedValue(result).value).toBe(0); // NIL
    });

    it('should return NIL for non-RLIST', () => {
      const vm = resetVM();

      vm.push(toTaggedValue(42, Tag.INTEGER)); // Not an RLIST
      vm.push(toTaggedValue(0, Tag.INTEGER));
      rlistGetAtOp(vm);

      const result = vm.peek();
      expect(fromTaggedValue(result).value).toBe(0); // NIL
    });
  });

  describe('rlistSetAtOp', () => {
    it('should set value at valid index', () => {
      const vm = resetVM();

      // Create RLIST [10, 20, 30]
      openRListOp(vm);
      vm.push(toTaggedValue(10, Tag.INTEGER));
      vm.push(toTaggedValue(20, Tag.INTEGER));
      vm.push(toTaggedValue(30, Tag.INTEGER));
      closeRListOp(vm);

      // Set index 1 to 99
      vm.push(toTaggedValue(1, Tag.INTEGER));
      vm.push(toTaggedValue(99, Tag.INTEGER));
      rlistSetAtOp(vm);

      // RLIST should still be on stack
      const header = vm.peek();
      expect(fromTaggedValue(header).tag).toBe(Tag.RLIST);

      // Check that the value was updated (index 1 is at SP-12)
      const updatedValue = vm.memory.readFloat32(0, vm.SP - 12);
      expect(fromTaggedValue(updatedValue).value).toBe(99);
    });

    it('should return NIL for out of bounds index', () => {
      const vm = resetVM();

      openRListOp(vm);
      vm.push(toTaggedValue(10, Tag.INTEGER));
      closeRListOp(vm);

      vm.push(toTaggedValue(5, Tag.INTEGER)); // Index 5
      vm.push(toTaggedValue(99, Tag.INTEGER)); // New value
      rlistSetAtOp(vm);

      const result = vm.peek();
      expect(fromTaggedValue(result).value).toBe(0); // NIL
    });

    it('should return NIL when trying to overwrite compound value', () => {
      const vm = resetVM();

      // Create outer RLIST containing an inner RLIST
      openRListOp(vm);
      vm.push(toTaggedValue(10, Tag.INTEGER));

      // Add inner RLIST
      openRListOp(vm);
      vm.push(toTaggedValue(1, Tag.INTEGER));
      closeRListOp(vm);

      closeRListOp(vm);

      // Try to overwrite the inner RLIST (index 1)
      vm.push(toTaggedValue(1, Tag.INTEGER));
      vm.push(toTaggedValue(99, Tag.INTEGER));
      rlistSetAtOp(vm);

      const result = vm.peek();
      expect(fromTaggedValue(result).value).toBe(0); // NIL - refused to overwrite
    });

    it('should return NIL for non-RLIST', () => {
      const vm = resetVM();

      vm.push(toTaggedValue(42, Tag.INTEGER)); // Not an RLIST
      vm.push(toTaggedValue(0, Tag.INTEGER));   // Index
      vm.push(toTaggedValue(99, Tag.INTEGER));  // New value
      rlistSetAtOp(vm);

      const result = vm.peek();
      expect(fromTaggedValue(result).value).toBe(0); // NIL
    });
  });

  describe('Error handling', () => {
    it('should handle stack underflow gracefully', () => {
      const vm = resetVM();

      expect(() => rlistSlotOp(vm)).toThrow();
      expect(() => rlistSkipOp(vm)).toThrow();
      expect(() => rlistPrependOp(vm)).toThrow();
      expect(() => rlistAppendOp(vm)).toThrow();
      expect(() => rlistGetAtOp(vm)).toThrow();
      expect(() => rlistSetAtOp(vm)).toThrow();
    });

    it('should handle return stack underflow in closeRListOp', () => {
      const vm = resetVM();

      expect(() => closeRListOp(vm)).toThrow('Return stack underflow');
    });
  });
});

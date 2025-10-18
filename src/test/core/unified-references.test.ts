/**
 * Tests for unified data reference system
 * Tests Tag.STACK_REF, Tag.RSTACK_REF, Tag.GLOBAL_REF polymorphism
 */
import { describe, test, expect, beforeEach } from '@jest/globals';
import { vm, initializeInterpreter } from '../../core/global-state';
import {
  Tag,
  fromTaggedValue,
  createLocalRef,
  createDataRef,
  decodeDataRef,
  NIL,
  isRef,
  isStackRef,
  isLocalRef,
  isGlobalRef,
  createGlobalRef,
  createSegmentRef,
} from '../../core';
import { fetchOp } from '../../ops/lists';
import {
  SEG_STACK,
  SEG_RSTACK,
  SEG_GLOBAL,
  STACK_BASE,
  RSTACK_BASE,
  GLOBAL_BASE,
  CELL_SIZE,
} from '../../core';

describe('Unified Reference System', () => {
  beforeEach(() => {
    initializeInterpreter();
    vm.debug = false;
  });

  describe('Single source verification', () => {
    test('reference guards should be available from refs module only', () => {
      const stackRef = createSegmentRef(0, 5);
      const localRef = createLocalRef(3);
      const globalRef = createGlobalRef(7);

      expect(typeof isRef).toBe('function');
      expect(typeof isStackRef).toBe('function');
      expect(typeof isLocalRef).toBe('function');
      expect(typeof isGlobalRef).toBe('function');

      expect(isRef(stackRef)).toBe(true);
      expect(isStackRef(stackRef)).toBe(true);
      expect(isLocalRef(localRef)).toBe(true);
      expect(isGlobalRef(globalRef)).toBe(true);
    });
  });

  describe('Tag definitions and type guards', () => {
    test('should have correct tag values', () => {
      expect(Tag.STACK_REF).toBe(9);
      expect(Tag.RSTACK_REF).toBe(10);
      expect(Tag.GLOBAL_REF).toBe(11);
    });

    test('isRef should identify all reference types', () => {
      const stackRef = createSegmentRef(0, 5);
      const localRef = createLocalRef(3);
      const globalRef = createGlobalRef(7);
      const number = 42;

      expect(isRef(stackRef)).toBe(true);
      expect(isRef(localRef)).toBe(true);
      expect(isRef(globalRef)).toBe(true);
      expect(isRef(number)).toBe(false);
      expect(isRef(NIL)).toBe(false);
    });

    test('specific type guards should work correctly', () => {
      const stackRef = createSegmentRef(0, 5);
      const localRef = createLocalRef(3);
      const globalRef = createGlobalRef(7);

      expect(isStackRef(stackRef)).toBe(true);
      expect(isStackRef(localRef)).toBe(false);
      expect(isStackRef(globalRef)).toBe(false);

      expect(isLocalRef(stackRef)).toBe(false);
      expect(isLocalRef(localRef)).toBe(true);
      expect(isLocalRef(globalRef)).toBe(false);

      expect(isGlobalRef(stackRef)).toBe(false);
      expect(isGlobalRef(localRef)).toBe(false);
      expect(isGlobalRef(globalRef)).toBe(true);
    });

    test('should identify STACK_REF correctly', () => {
      const stackRef = createSegmentRef(0, 5);
      expect(isRef(stackRef)).toBe(true);
      expect(isStackRef(stackRef)).toBe(true);
      expect(isLocalRef(stackRef)).toBe(false);
      expect(isGlobalRef(stackRef)).toBe(false);
    });
  });

  describe('Reference construction helpers', () => {
    test('createStackRef should create correct tagged value', () => {
      const ref = createSegmentRef(0, 42);
      const { tag, value } = fromTaggedValue(ref);

      expect(tag).toBe(Tag.STACK_REF);
      expect(value).toBe(42);
      expect(isStackRef(ref)).toBe(true);
    });

    test('createLocalRef should create correct tagged value', () => {
      const ref = createLocalRef(7);
      const { tag, value } = fromTaggedValue(ref);

      expect(tag).toBe(Tag.RSTACK_REF);
      expect(value).toBe(7);
    });

    test('createGlobalRef should create correct tagged value', () => {
      const ref = createGlobalRef(123);
      const { tag, value } = fromTaggedValue(ref);

      expect(tag).toBe(Tag.GLOBAL_REF);
      expect(value).toBe(123);
    });

    test('createDataRef encodes absolute cell index per segment', () => {
      const samples = [
        { segment: SEG_GLOBAL, base: GLOBAL_BASE, cellIndex: 3 },
        { segment: SEG_STACK, base: STACK_BASE, cellIndex: 5 },
        { segment: SEG_RSTACK, base: RSTACK_BASE, cellIndex: 7 },
      ];

      for (const { segment, base, cellIndex } of samples) {
        const ref = createDataRef(segment, cellIndex);
        const { tag, value } = fromTaggedValue(ref);
        expect(tag).toBe(Tag.DATA_REF);
        expect(value).toBe(base / CELL_SIZE + cellIndex);

        const components = decodeDataRef(ref);
        expect(components.segment).toBe(segment);
        expect(components.cellIndex).toBe(cellIndex);
        expect(components.absoluteCellIndex).toBe(value);
      }
    });

    test('should handle 16-bit reference values', () => {
      const maxRef = createLocalRef(65535);
      const { value } = fromTaggedValue(maxRef);
      expect(value).toBe(65535);
    });
  });

  describe('fetchOp polymorphism', () => {
    test('should handle RSTACK_REF correctly', () => {
      // Store value directly at absolute address 1008 on return stack
      vm.memory.writeFloat32(SEG_RSTACK, 80, 99);

      // Create local reference pointing to absolute cell index 20 (80/4)
      const localRef = createLocalRef(20);
      vm.push(localRef);

      // Fetch via reference
      fetchOp(vm);

      // Should get the stored value
      expect(vm.getStackData()).toEqual([99]);
    });

    test('should handle GLOBAL_REF read', () => {
      // Write a value into SEG_GLOBAL at cell index 42
      const cellIndex = 42;
      vm.memory.writeFloat32(SEG_GLOBAL, cellIndex * CELL_SIZE, 123.5);
      const globalRef = createGlobalRef(cellIndex);
      vm.push(globalRef);
      fetchOp(vm);
      expect(vm.getStackData()).toEqual([123.5]);
    });

    test('should reject invalid reference types', () => {
      vm.push(42); // Raw number, not a reference

      expect(() => fetchOp(vm)).toThrow(/fetch expects reference address \(DATA_REF or legacy/i);
    });

    test('should work with multiple RSTACK_REF in same function', () => {
      // Store values directly at different absolute addresses on return stack
      vm.memory.writeFloat32(SEG_RSTACK, 40, 10); // cell index 10
      vm.memory.writeFloat32(SEG_RSTACK, 80, 20); // cell index 20
      vm.memory.writeFloat32(SEG_RSTACK, 120, 30); // cell index 30

      // Fetch from cell index 50
      vm.push(createLocalRef(20));
      fetchOp(vm);
      expect(vm.pop()).toBe(20);

      // Fetch from cell index 125
      vm.push(createLocalRef(30));
      fetchOp(vm);
      expect(vm.pop()).toBe(30);

      // Fetch from cell index 25
      vm.push(createLocalRef(10));
      fetchOp(vm);
      expect(vm.pop()).toBe(10);
    });

    test('should handle different function frames correctly', () => {
      // Store values at different absolute addresses on return stack
      vm.memory.writeFloat32(SEG_RSTACK, 160, 100); // cell index 40
      vm.memory.writeFloat32(SEG_RSTACK, 200, 200); // cell index 50

      const ref1 = createLocalRef(40);
      vm.push(ref1);
      fetchOp(vm);
      expect(vm.pop()).toBe(100);

      const ref2 = createLocalRef(50);
      vm.push(ref2);
      fetchOp(vm);
      expect(vm.pop()).toBe(200);
    });
  });

  describe('Reference polymorphism integration', () => {
    test('same operations work with different reference types', () => {
      // This test demonstrates that the same fetch operation
      // works polymorphically with different reference types

      // Store value directly at absolute address on return stack
      vm.memory.writeFloat32(SEG_RSTACK, 200, 42); // cell index 50

      // Create different reference types pointing to different storage
      const localRef = createLocalRef(50);
      // Note: STACK_REF would point to stack storage (tested elsewhere)
      // Note: GLOBAL_REF not yet implemented

      // Verify local reference works
      vm.push(localRef);
      fetchOp(vm);
      expect(vm.pop()).toBe(42);

      // Same fetchOp function, different behavior based on reference type
      expect(isLocalRef(localRef)).toBe(true);
    });
  });

  describe('Error handling', () => {
    test('should provide clear error messages', () => {
      vm.push(NIL);

      expect(() => fetchOp(vm)).toThrow(
        'fetch expects reference address (DATA_REF or legacy STACK_REF/RSTACK_REF/GLOBAL_REF)',
      );
    });

    test('should handle stack underflow in fetchOp', () => {
      // Empty stack
      expect(() => fetchOp(vm)).toThrow('Stack underflow');
    });
  });
});

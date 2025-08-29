/**
 * Tests for unified data reference system
 * Tests Tag.STACK_REF, Tag.RSTACK_REF, Tag.GLOBAL_REF polymorphism
 */
import { describe, test, expect, beforeEach } from '@jest/globals';
import { vm, initializeInterpreter } from '../../core/globalState';
import {
  Tag,
  fromTaggedValue,
  createLocalRef,
  NIL,
} from '../../core/tagged';
import {
  isRef,
  isStackRef,
  isLocalRef,
  isGlobalRef,
  createGlobalRef,
  createStackRef,
} from '../../core/refs';
import { fetchOp } from '../../ops/list-ops';
import { SEG_RSTACK } from '../../core/constants';

describe('Unified Reference System', () => {
  beforeEach(() => {
    initializeInterpreter();
    vm.debug = false;
  });

  describe('Single source verification', () => {
    test('reference guards should be available from refs module only', () => {
      const stackRef = createStackRef(5);
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
      const stackRef = createStackRef(5);
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
      const stackRef = createStackRef(5);
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
      const stackRef = createStackRef(5);
      expect(isRef(stackRef)).toBe(true);
      expect(isStackRef(stackRef)).toBe(true);
      expect(isLocalRef(stackRef)).toBe(false);
      expect(isGlobalRef(stackRef)).toBe(false);
    });
  });

  describe('Reference construction helpers', () => {
    test('createStackRef should create correct tagged value', () => {
      const ref = createStackRef(42);
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

    test('should handle 16-bit reference values', () => {
      const maxRef = createLocalRef(65535);
      const { value } = fromTaggedValue(maxRef);
      expect(value).toBe(65535);
    });
  });

  describe('fetchOp polymorphism', () => {
    test('should handle RSTACK_REF correctly', () => {
      // Store value directly at absolute address 1008 on return stack
      vm.memory.writeFloat32(SEG_RSTACK, 1008, 99);

      // Create local reference pointing to absolute cell index 252 (1008/4)
      const localRef = createLocalRef(252);
      vm.push(localRef);

      // Fetch via reference
      fetchOp(vm);

      // Should get the stored value
      expect(vm.getStackData()).toEqual([99]);
    });

    test('should handle GLOBAL_REF with appropriate error', () => {
      const globalRef = createGlobalRef(42);
      vm.push(globalRef);

      expect(() => fetchOp(vm)).toThrow('Global variable references not yet implemented');
    });

    test('should reject invalid reference types', () => {
      vm.push(42); // Raw number, not a reference

      expect(() => fetchOp(vm)).toThrow('fetch expects reference address');
    });

    test('should work with multiple RSTACK_REF in same function', () => {
      // Store values directly at different absolute addresses on return stack
      vm.memory.writeFloat32(SEG_RSTACK, 100, 10); // cell index 25
      vm.memory.writeFloat32(SEG_RSTACK, 200, 20); // cell index 50
      vm.memory.writeFloat32(SEG_RSTACK, 500, 30); // cell index 125

      // Fetch from cell index 50
      vm.push(createLocalRef(50));
      fetchOp(vm);
      expect(vm.pop()).toBe(20);

      // Fetch from cell index 125
      vm.push(createLocalRef(125));
      fetchOp(vm);
      expect(vm.pop()).toBe(30);

      // Fetch from cell index 25
      vm.push(createLocalRef(25));
      fetchOp(vm);
      expect(vm.pop()).toBe(10);
    });

    test('should handle different function frames correctly', () => {
      // Store values at different absolute addresses on return stack
      vm.memory.writeFloat32(SEG_RSTACK, 800, 100); // cell index 200
      vm.memory.writeFloat32(SEG_RSTACK, 1200, 200); // cell index 300

      const ref1 = createLocalRef(200);
      vm.push(ref1);
      fetchOp(vm);
      expect(vm.pop()).toBe(100);

      const ref2 = createLocalRef(300);
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
      vm.memory.writeFloat32(SEG_RSTACK, 1600, 42); // cell index 400

      // Create different reference types pointing to different storage
      const localRef = createLocalRef(400);
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
        'fetch expects reference address (STACK_REF, RSTACK_REF, or GLOBAL_REF)',
      );
    });

    test('should handle stack underflow in fetchOp', () => {
      // Empty stack
      expect(() => fetchOp(vm)).toThrow('Stack underflow');
    });
  });
});

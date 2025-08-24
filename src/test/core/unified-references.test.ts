/**
 * Tests for unified data reference system
 * Tests Tag.STACK_REF, Tag.LOCAL_REF, Tag.GLOBAL_REF polymorphism
 */
import { describe, test, expect, beforeEach } from '@jest/globals';
import { vm, initializeInterpreter } from '../../core/globalState';
import { 
  Tag, 
  toTaggedValue, 
  fromTaggedValue,
  isRef,
  isStackRef,
  isLocalRef,
  isGlobalRef,
  createStackRef,
  createLocalRef,
  createGlobalRef
} from '../../core/tagged';
import { fetchOp } from '../../ops/list-ops';
import { initVarOp } from '../../ops/builtins';

describe('Unified Reference System', () => {
  beforeEach(() => {
    initializeInterpreter();
    vm.debug = false;
  });

  describe('Tag definitions and type guards', () => {
    test('should have correct tag values', () => {
      expect(Tag.STACK_REF).toBe(9);
      expect(Tag.LOCAL_REF).toBe(10);
      expect(Tag.GLOBAL_REF).toBe(11);
    });

    test('isRef should identify all reference types', () => {
      const stackRef = createStackRef(5);
      const localRef = createLocalRef(3);
      const globalRef = createGlobalRef(7);
      const number = 42;
      const nilValue = toTaggedValue(0, Tag.SENTINEL);

      expect(isRef(stackRef)).toBe(true);
      expect(isRef(localRef)).toBe(true);
      expect(isRef(globalRef)).toBe(true);
      expect(isRef(number)).toBe(false);
      expect(isRef(nilValue)).toBe(false);
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
      const {tag, value} = fromTaggedValue(ref);
      
      expect(tag).toBe(Tag.STACK_REF);
      expect(value).toBe(42);
      expect(isStackRef(ref)).toBe(true);
    });

    test('createLocalRef should create correct tagged value', () => {
      const ref = createLocalRef(7);
      const {tag, value} = fromTaggedValue(ref);
      
      expect(tag).toBe(Tag.LOCAL_REF);
      expect(value).toBe(7);
    });

    test('createGlobalRef should create correct tagged value', () => {
      const ref = createGlobalRef(123);
      const {tag, value} = fromTaggedValue(ref);
      
      expect(tag).toBe(Tag.GLOBAL_REF);
      expect(value).toBe(123);
    });

    test('should handle 16-bit reference values', () => {
      const maxRef = createLocalRef(65535);
      const {value} = fromTaggedValue(maxRef);
      expect(value).toBe(65535);
    });
  });

  describe('fetchOp polymorphism', () => {
    test('should handle LOCAL_REF correctly', () => {
      // Set up a function frame
      vm.BP = 1000;  // Simulate function call frame
      
      // Initialize local variable slot 2 with value 99
      vm.push(99);
      vm.compiler.compile16(2);  // slot 2
      initVarOp(vm);
      
      // Create local reference to slot 2
      const localRef = createLocalRef(2);
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
      vm.push(42);  // Raw number, not a reference
      
      expect(() => fetchOp(vm)).toThrow('fetch expects reference address');
    });

    test('should work with multiple LOCAL_REF in same function', () => {
      vm.BP = 2000;
      
      // Initialize multiple local variables
      vm.push(10); vm.compiler.compile16(0); initVarOp(vm);  // slot 0 = 10
      vm.push(20); vm.compiler.compile16(1); initVarOp(vm);  // slot 1 = 20  
      vm.push(30); vm.compiler.compile16(5); initVarOp(vm);  // slot 5 = 30
      
      // Fetch slot 1
      vm.push(createLocalRef(1));
      fetchOp(vm);
      expect(vm.pop()).toBe(20);
      
      // Fetch slot 5  
      vm.push(createLocalRef(5));
      fetchOp(vm);
      expect(vm.pop()).toBe(30);
      
      // Fetch slot 0
      vm.push(createLocalRef(0));
      fetchOp(vm);
      expect(vm.pop()).toBe(10);
    });

    test('should handle different function frames correctly', () => {
      // First function frame
      vm.BP = 500;
      vm.push(100); vm.compiler.compile16(0); initVarOp(vm);
      
      const ref1 = createLocalRef(0);
      vm.push(ref1);
      fetchOp(vm);
      expect(vm.pop()).toBe(100);
      
      // Second function frame (different BP)
      vm.BP = 1500;  
      vm.push(200); vm.compiler.compile16(0); initVarOp(vm);
      
      const ref2 = createLocalRef(0);
      vm.push(ref2);
      fetchOp(vm);
      expect(vm.pop()).toBe(200);  // Should get value from new frame
    });
  });

  describe('Reference polymorphism integration', () => {
    test('same operations work with different reference types', () => {
      // This test demonstrates that the same fetch operation
      // works polymorphically with different reference types
      
      vm.BP = 3000;
      
      // Setup local variable
      vm.push(42);
      vm.compiler.compile16(3);
      initVarOp(vm);
      
      // Create different reference types pointing to different storage
      const localRef = createLocalRef(3);
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
      const nilValue = toTaggedValue(0, Tag.SENTINEL);
      vm.push(nilValue);
      
      expect(() => fetchOp(vm)).toThrow('fetch expects reference address (STACK_REF, LOCAL_REF, or GLOBAL_REF)');
    });

    test('should handle stack underflow in fetchOp', () => {
      // Empty stack
      expect(() => fetchOp(vm)).toThrow('Stack underflow');
    });
  });
});
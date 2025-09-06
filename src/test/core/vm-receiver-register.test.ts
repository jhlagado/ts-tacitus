import { VM } from '@src/core';
import { Compiler } from '../../lang/compiler';
import { resetVM } from '../utils/vm-test-utils';

describe('VM Receiver Register', () => {
  let vm: VM;

  beforeEach(() => {
    resetVM();
    vm = new VM();
    const compiler = new Compiler(vm);
    vm.initializeCompiler(compiler);
  });

  describe('Initialization', () => {
    test('should initialize receiver register to 0', () => {
      expect(vm.getReceiver()).toBe(0);
    });

    test('should have receiver property accessible', () => {
      expect(vm.receiver).toBe(0);
    });
  });

  describe('Getter and Setter Methods', () => {
    test('should get current receiver value', () => {
      expect(vm.getReceiver()).toBe(0);
    });

    test('should set receiver to a new slot index', () => {
      vm.setReceiver(5);
      expect(vm.getReceiver()).toBe(5);
    });

    test('should allow setting receiver multiple times', () => {
      vm.setReceiver(10);
      expect(vm.getReceiver()).toBe(10);

      vm.setReceiver(25);
      expect(vm.getReceiver()).toBe(25);

      vm.setReceiver(0);
      expect(vm.getReceiver()).toBe(0);
    });

    test('should handle negative slot indices', () => {
      vm.setReceiver(-1);
      expect(vm.getReceiver()).toBe(-1);
    });

    test('should handle large slot indices', () => {
      const largeIndex = 65535;
      vm.setReceiver(largeIndex);
      expect(vm.getReceiver()).toBe(largeIndex);
    });
  });

  describe('State Persistence', () => {
    test('should maintain receiver value across stack operations', () => {
      vm.setReceiver(15);

      vm.push(1.0);
      vm.push(2.0);
      vm.push(3.0);

      expect(vm.getReceiver()).toBe(15);

      vm.pop();
      vm.pop();

      expect(vm.getReceiver()).toBe(15);
    });

    test('should maintain receiver value across instruction pointer changes', () => {
      vm.setReceiver(42);

      vm.IP = 100;
      expect(vm.getReceiver()).toBe(42);

      vm.reset();
      expect(vm.getReceiver()).toBe(42);
    });

    test('should maintain receiver value across return stack operations', () => {
      vm.setReceiver(33);

      vm.rpush(100.0);
      vm.rpush(200.0);

      expect(vm.getReceiver()).toBe(33);

      vm.rpop();
      expect(vm.getReceiver()).toBe(33);
    });
  });

  describe('Integration with VM State', () => {
    test('should be independent of other VM registers', () => {
      const initialSP = vm.SP;
      const initialRP = vm.RP;
      const initialBP = vm.BP;
      const initialIP = vm.IP;

      vm.setReceiver(99);

      expect(vm.SP).toBe(initialSP);
      expect(vm.RP).toBe(initialRP);
      expect(vm.BP).toBe(initialBP);
      expect(vm.IP).toBe(initialIP);

      expect(vm.getReceiver()).toBe(99);
    });

    test('should not affect stack data when modified', () => {
      vm.push(10.5);
      vm.push(20.7);
      vm.push(30.9);

      const stackBefore = vm.getStackData();

      vm.setReceiver(77);

      const stackAfter = vm.getStackData();
      expect(stackAfter).toEqual(stackBefore);
    });
  });

  describe('Reset Behavior', () => {
    test('should be reset by resetVM utility', () => {
      vm.setReceiver(123);
      expect(vm.getReceiver()).toBe(123);

      resetVM();

      const freshVM = new VM();
      const compiler = new Compiler(freshVM);
      freshVM.initializeCompiler(compiler);

      expect(freshVM.getReceiver()).toBe(0);
    });

    test('should maintain receiver through regular VM.reset()', () => {
      vm.setReceiver(456);

      vm.reset();

      expect(vm.getReceiver()).toBe(456);
    });
  });

  describe('Edge Cases', () => {
    test('should handle boundary values correctly', () => {
      vm.setReceiver(0);
      expect(vm.getReceiver()).toBe(0);

      const maxSafe = Number.MAX_SAFE_INTEGER;
      vm.setReceiver(maxSafe);
      expect(vm.getReceiver()).toBe(maxSafe);

      const minSafe = Number.MIN_SAFE_INTEGER;
      vm.setReceiver(minSafe);
      expect(vm.getReceiver()).toBe(minSafe);
    });

    test('should handle floating point values by truncation', () => {
      vm.setReceiver(42.7);
      expect(vm.getReceiver()).toBe(42.7);
    });
  });
});

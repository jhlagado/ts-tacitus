import { vm } from '../../../core/globalState';
import { swapOp } from '../../../ops/builtins-stack';
import { resetVM } from '../../utils/test-utils';

import { describe, test, expect } from '@jest/globals';

describe('List swap operations', () => {
  beforeEach(() => {
    resetVM();
  });

  describe('swap', () => {
    test('should swap two simple values', () => {
      vm.push(5);  // Base element
      vm.push(10); // NOS
      vm.push(20); // TOS
      
      swapOp(vm);
      
      expect(vm.getStackData()).toEqual([5, 20, 10]);
    });

    test('should swap top two values on deeper stack', () => {
      vm.push(5);
      vm.push(1);
      vm.push(2);
      vm.push(3);
      vm.push(4);
      vm.push(5);
      vm.push(10); // NOS
      vm.push(20); // TOS
      
      swapOp(vm);
      
      expect(vm.getStackData()).toEqual([5, 1, 2, 3, 4, 5, 20, 10]);
    });

    test('should throw error when trying to swap with insufficient items', () => {
      vm.push(42); // Only one item on stack
      
      expect(() => {
        swapOp(vm);
      }).toThrow('Stack underflow');
    });
  });
});
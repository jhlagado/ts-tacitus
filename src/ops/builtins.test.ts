import { addOp, subtractOp, multiplyOp, divideOp } from './builtins-math';
import { dupOp, dropOp, swapOp } from './builtins-stack';
import { initializeInterpreter, vm } from '../core/globalState';
describe('Built-in Words', () => {
  beforeEach(() => {
    initializeInterpreter();
  });
  describe('Arithmetic Operations', () => {
    test('add should add two numbers', () => {
      vm.push(5);
      vm.push(3);
      addOp(vm);
      expect(vm.getStackData()).toEqual([8]);
    });
    test('add should throw on insufficient stack items', () => {
      vm.push(5);
      expect(() => addOp(vm)).toThrow(`Stack underflow: Cannot pop value (stack: [])`);
    });
    test('sub should subtract numbers', () => {
      vm.push(5);
      vm.push(3);
      subtractOp(vm);
      expect(vm.getStackData()).toEqual([2]);
    });
    test('sub should throw on insufficient stack items', () => {
      vm.push(5);
      expect(() => subtractOp(vm)).toThrow(`Stack underflow: Cannot pop value (stack: [])`);
    });
    test('mul should multiply numbers', () => {
      vm.push(5);
      vm.push(3);
      multiplyOp(vm);
      expect(vm.getStackData()).toEqual([15]);
    });
    test('mul should throw on insufficient stack items', () => {
      vm.push(5);
      expect(() => multiplyOp(vm)).toThrow(`Stack underflow: Cannot pop value (stack: [])`);
    });
    test('div should divide numbers', () => {
      vm.push(6);
      vm.push(3);
      divideOp(vm);
      expect(vm.getStackData()).toEqual([2]);
    });
  });
  describe('Stack Operations', () => {
    test('dup should duplicate top item', () => {
      vm.push(5);
      dupOp(vm);
      expect(vm.getStackData()).toEqual([5, 5]);
    });
    test('drop should remove top item', () => {
      vm.push(5);
      dropOp(vm);
      expect(vm.getStackData()).toEqual([]);
    });
    test('swap should swap top two items', () => {
      vm.push(5);
      vm.push(3);
      swapOp(vm);
      expect(vm.getStackData()).toEqual([3, 5]);
    });
    test('drop should throw on empty stack', () => {
      expect(() => dropOp(vm)).toThrow(
        `Stack underflow: 'drop' requires 1 operand (stack: ${JSON.stringify(vm.getStackData())})`,
      );
    });
    test('swap should throw on insufficient stack items', () => {
      vm.push(5);
      expect(() => swapOp(vm)).toThrow(`Stack underflow: Cannot pop value (stack: [])`);
    });
  });
  describe('Arithmetic Operations', () => {
    test('add should add two numbers', () => {
      vm.push(5);
      vm.push(3);
      addOp(vm);
      expect(vm.getStackData()).toEqual([8]);
    });
    test('sub should subtract numbers', () => {
      vm.push(5);
      vm.push(3);
      subtractOp(vm);
      expect(vm.getStackData()).toEqual([2]);
    });
    test('mul should multiply numbers', () => {
      vm.push(5);
      vm.push(3);
      multiplyOp(vm);
      expect(vm.getStackData()).toEqual([15]);
    });
    test('div should divide numbers', () => {
      vm.push(6);
      vm.push(3);
      divideOp(vm);
      expect(vm.getStackData()).toEqual([2]);
    });
  });
  describe('Stack Operations', () => {
    test('dup should duplicate top item', () => {
      vm.push(5);
      dupOp(vm);
      expect(vm.getStackData()).toEqual([5, 5]);
    });
    test('drop should remove top item', () => {
      vm.push(5);
      dropOp(vm);
      expect(vm.getStackData()).toEqual([]);
    });
    test('swap should swap top two items', () => {
      vm.push(5);
      vm.push(3);
      swapOp(vm);
      expect(vm.getStackData()).toEqual([3, 5]);
    });
    test('drop should throw on empty stack', () => {
      expect(() => dropOp(vm)).toThrow(
        `Stack underflow: 'drop' requires 1 operand (stack: ${JSON.stringify(vm.getStackData())})`,
      );
    });
    test('swap should throw on insufficient stack items', () => {
      vm.push(5);
      expect(() => swapOp(vm)).toThrow(`Stack underflow: Cannot pop value (stack: [])`);
    });
  });
});

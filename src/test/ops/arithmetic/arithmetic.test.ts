import { vm } from '../../../lang/runtime';
import { executeProgram } from '../../../lang/interpreter';
import {
  addOp,
  subtractOp,
  multiplyOp,
  divideOp,
  powOp,
  modOp,
  minOp,
  maxOp,
  absOp,
  negOp,
  signOp,
  expOp,
  lnOp,
  logOp,
  sqrtOp,
} from '../../../ops/math';
import { resetVM } from '../../utils/vm-test-utils';

describe('Arithmetic Operations', () => {
  beforeEach(() => {
    resetVM();
  });

  describe('simple values', () => {
    test('should add two positive numbers', () => {
      vm.push(5);
      vm.push(3);
      addOp(vm);
      expect(vm.getStackData()).toEqual([8]);
    });

    test('should add positive and negative numbers', () => {
      vm.push(-5);
      vm.push(10);
      addOp(vm);
      expect(vm.getStackData()).toEqual([5]);
    });

    test('should add zero values', () => {
      vm.push(0);
      vm.push(0);
      addOp(vm);
      expect(vm.getStackData()).toEqual([0]);
    });

    test('should subtract two numbers correctly', () => {
      vm.push(10);
      vm.push(4);
      subtractOp(vm);
      expect(vm.getStackData()).toEqual([6]);
    });

    test('should subtract with negative result', () => {
      vm.push(5);
      vm.push(10);
      subtractOp(vm);
      expect(vm.getStackData()).toEqual([-5]);
    });

    test('should subtract negative operands', () => {
      vm.push(-3);
      vm.push(-8);
      subtractOp(vm);
      expect(vm.getStackData()).toEqual([5]);
    });

    test('should multiply two positive numbers', () => {
      vm.push(5);
      vm.push(3);
      multiplyOp(vm);
      expect(vm.getStackData()).toEqual([15]);
    });

    test('should multiply with negative numbers', () => {
      vm.push(-5);
      vm.push(3);
      multiplyOp(vm);
      expect(vm.getStackData()).toEqual([-15]);
    });

    test('should multiply by zero', () => {
      vm.push(5);
      vm.push(0);
      multiplyOp(vm);
      expect(vm.getStackData()).toEqual([0]);
    });

    test('should divide two numbers correctly', () => {
      vm.push(10);
      vm.push(2);
      divideOp(vm);
      expect(vm.getStackData()).toEqual([5]);
    });

    test('should divide with decimal result', () => {
      vm.push(10);
      vm.push(3);
      divideOp(vm);
      expect(vm.pop()).toBeCloseTo(3.33333, 4);
    });

    test('should divide negative numbers', () => {
      vm.push(-10);
      vm.push(2);
      divideOp(vm);
      expect(vm.getStackData()).toEqual([-5]);
    });

    test('should handle division by zero', () => {
      vm.push(5);
      vm.push(0);
      divideOp(vm);
      expect(vm.getStackData()).toEqual([Infinity]);
    });

    test('should calculate power correctly', () => {
      vm.push(2);
      vm.push(3);
      powOp(vm);
      expect(vm.getStackData()).toEqual([8]);
    });

    test('should handle fractional exponents', () => {
      vm.push(4);
      vm.push(0.5);
      powOp(vm);
      expect(vm.getStackData()).toEqual([2]);
    });

    test('should handle negative base', () => {
      vm.push(-2);
      vm.push(2);
      powOp(vm);
      expect(vm.getStackData()).toEqual([4]);
    });

    test('should handle zero base', () => {
      vm.push(0);
      vm.push(5);
      powOp(vm);
      expect(vm.getStackData()).toEqual([0]);
    });

    test('should calculate modulo correctly', () => {
      vm.push(10);
      vm.push(3);
      modOp(vm);
      expect(vm.getStackData()).toEqual([1]);
    });

    test('should handle negative modulo', () => {
      vm.push(-10);
      vm.push(3);
      modOp(vm);
      expect(vm.getStackData()).toEqual([-1]);
    });

    test('should handle zero modulus', () => {
      vm.push(5);
      vm.push(0);
      modOp(vm);
      expect(vm.pop()).toBeNaN();
    });

    test('should return minimum value', () => {
      vm.push(10);
      vm.push(5);
      minOp(vm);
      expect(vm.getStackData()).toEqual([5]);
    });

    test('should handle negative min values', () => {
      vm.push(-5);
      vm.push(-10);
      minOp(vm);
      expect(vm.getStackData()).toEqual([-10]);
    });

    test('should return maximum value', () => {
      vm.push(10);
      vm.push(5);
      maxOp(vm);
      expect(vm.getStackData()).toEqual([10]);
    });

    test('should handle negative max values', () => {
      vm.push(-5);
      vm.push(-10);
      maxOp(vm);
      expect(vm.getStackData()).toEqual([-5]);
    });

    test('should return absolute value', () => {
      vm.push(-5);
      absOp(vm);
      expect(vm.getStackData()).toEqual([5]);
    });

    test('should return same value for positive absolute', () => {
      vm.push(10);
      absOp(vm);
      expect(vm.getStackData()).toEqual([10]);
    });

    test('should handle zero absolute', () => {
      vm.push(0);
      absOp(vm);
      expect(vm.getStackData()).toEqual([0]);
    });

    test('should negate positive number', () => {
      vm.push(5);
      negOp(vm);
      expect(vm.getStackData()).toEqual([-5]);
    });

    test('should negate negative number', () => {
      vm.push(-3);
      negOp(vm);
      expect(vm.getStackData()).toEqual([3]);
    });

    test('should handle zero negation', () => {
      vm.push(0);
      negOp(vm);
      expect(vm.getStackData()).toEqual([-0]);
    });

    test('should return sign of positive number', () => {
      vm.push(5);
      signOp(vm);
      expect(vm.getStackData()).toEqual([1]);
    });

    test('should return sign of negative number', () => {
      vm.push(-3);
      signOp(vm);
      expect(vm.getStackData()).toEqual([-1]);
    });

    test('should return sign of zero', () => {
      vm.push(0);
      signOp(vm);
      expect(vm.getStackData()).toEqual([0]);
    });

    test('should calculate square root', () => {
      vm.push(16);
      sqrtOp(vm);
      expect(vm.getStackData()).toEqual([4]);
    });

    test('should handle zero square root', () => {
      vm.push(0);
      sqrtOp(vm);
      expect(vm.getStackData()).toEqual([0]);
    });

    test('should calculate exponential', () => {
      vm.push(1);
      expOp(vm);
      expect(vm.pop()).toBeCloseTo(Math.E, 5);
    });

    test('should calculate natural logarithm', () => {
      vm.push(Math.E);
      lnOp(vm);
      expect(vm.pop()).toBeCloseTo(1, 5);
    });

    test('should calculate log base 10', () => {
      vm.push(100);
      logOp(vm);
      expect(vm.pop()).toBeCloseTo(2, 5);
    });
  });

  describe('error cases', () => {
    test('should throw on add stack underflow', () => {
      vm.push(5);
      expect(() => addOp(vm)).toThrow('Stack underflow');
    });

    test('should throw on subtract stack underflow', () => {
      vm.push(5);
      expect(() => subtractOp(vm)).toThrow('Stack underflow');
    });

    test('should throw on multiply stack underflow', () => {
      vm.push(5);
      expect(() => multiplyOp(vm)).toThrow('Stack underflow');
    });

    test('should throw on divide stack underflow', () => {
      vm.push(5);
      expect(() => divideOp(vm)).toThrow('Stack underflow');
    });

    test('should throw on power stack underflow', () => {
      vm.push(5);
      expect(() => powOp(vm)).toThrow('Stack underflow');
    });

    test('should throw on modulo stack underflow', () => {
      vm.push(5);
      expect(() => modOp(vm)).toThrow('Stack underflow');
    });

    test('should throw on min stack underflow', () => {
      vm.push(5);
      expect(() => minOp(vm)).toThrow('Stack underflow');
    });

    test('should throw on max stack underflow', () => {
      vm.push(5);
      expect(() => maxOp(vm)).toThrow('Stack underflow');
    });
  });

  describe('integration tests', () => {
    test('should handle add operation with Tacit syntax', () => {
      executeProgram('5 3 add');
      expect(vm.getStackData()).toEqual([8]);
    });

    test('should handle sub operation with Tacit syntax', () => {
      executeProgram('10 4 sub');
      expect(vm.getStackData()).toEqual([6]);
    });

    test('should handle mul operation with Tacit syntax', () => {
      executeProgram('5 4 mul');
      expect(vm.getStackData()).toEqual([20]);
    });

    test('should handle div operation with Tacit syntax', () => {
      executeProgram('10 2 div');
      expect(vm.getStackData()).toEqual([5]);
    });

    test('should handle min operation with Tacit syntax', () => {
      executeProgram('10 5 min');
      expect(vm.getStackData()).toEqual([5]);
      resetVM();
      executeProgram('3 8 min');
      expect(vm.getStackData()).toEqual([3]);
    });

    test('should handle max operation with Tacit syntax', () => {
      executeProgram('10 5 max');
      expect(vm.getStackData()).toEqual([10]);
      resetVM();
      executeProgram('3 8 max');
      expect(vm.getStackData()).toEqual([8]);
    });

    test('should handle pow operation with Tacit syntax', () => {
      executeProgram('2 3 pow');
      expect(vm.getStackData()).toEqual([8]);
    });

    test('should handle eq operation with Tacit syntax', () => {
      executeProgram('5 5 eq');
      expect(vm.getStackData()).toEqual([1]);
      resetVM();
      executeProgram('5 6 eq');
      expect(vm.getStackData()).toEqual([0]);
    });

    test('should handle lt operation with Tacit syntax', () => {
      executeProgram('5 10 lt');
      expect(vm.getStackData()).toEqual([1]);
      resetVM();
      executeProgram('10 5 lt');
      expect(vm.getStackData()).toEqual([0]);
      resetVM();
      executeProgram('5 5 lt');
      expect(vm.getStackData()).toEqual([0]);
    });

    test('should handle le operation with Tacit syntax', () => {
      executeProgram('5 10 le');
      expect(vm.getStackData()).toEqual([1]);
      resetVM();
      executeProgram('10 5 le');
      expect(vm.getStackData()).toEqual([0]);
      resetVM();
      executeProgram('5 5 le');
      expect(vm.getStackData()).toEqual([1]);
    });

    test('should handle gt operation with Tacit syntax', () => {
      executeProgram('10 5 gt');
      expect(vm.getStackData()).toEqual([1]);
      resetVM();
      executeProgram('5 10 gt');
      expect(vm.getStackData()).toEqual([0]);
      resetVM();
      executeProgram('5 5 gt');
      expect(vm.getStackData()).toEqual([0]);
    });

    test('should handle ge operation with Tacit syntax', () => {
      executeProgram('10 5 ge');
      expect(vm.getStackData()).toEqual([1]);
      resetVM();
      executeProgram('5 10 ge');
      expect(vm.getStackData()).toEqual([0]);
      resetVM();
      executeProgram('5 5 ge');
      expect(vm.getStackData()).toEqual([1]);
    });

    test('should handle mod operation with Tacit syntax', () => {
      executeProgram('10 3 mod');
      expect(vm.getStackData()).toEqual([1]);
      resetVM();
      executeProgram('10 5 mod');
      expect(vm.getStackData()).toEqual([0]);
    });
  });
});

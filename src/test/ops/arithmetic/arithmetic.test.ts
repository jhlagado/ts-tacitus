import { vm } from '../../../lang/runtime';
import { executeProgram } from '../../../lang/interpreter';
import { push, pop, getStackData } from '../../../core/vm';
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
      push(vm, 5);
      push(vm, 3);
      addOp(vm);
      expect(getStackData(vm)).toEqual([8]);
    });

    test('should add positive and negative numbers', () => {
      push(vm, -5);
      push(vm, 10);
      addOp(vm);
      expect(getStackData(vm)).toEqual([5]);
    });

    test('should add zero values', () => {
      push(vm, 0);
      push(vm, 0);
      addOp(vm);
      expect(getStackData(vm)).toEqual([0]);
    });

    test('should subtract two numbers correctly', () => {
      push(vm, 10);
      push(vm, 4);
      subtractOp(vm);
      expect(getStackData(vm)).toEqual([6]);
    });

    test('should subtract with negative result', () => {
      push(vm, 5);
      push(vm, 10);
      subtractOp(vm);
      expect(getStackData(vm)).toEqual([-5]);
    });

    test('should subtract negative operands', () => {
      push(vm, -3);
      push(vm, -8);
      subtractOp(vm);
      expect(getStackData(vm)).toEqual([5]);
    });

    test('should multiply two positive numbers', () => {
      push(vm, 5);
      push(vm, 3);
      multiplyOp(vm);
      expect(getStackData(vm)).toEqual([15]);
    });

    test('should multiply with negative numbers', () => {
      push(vm, -5);
      push(vm, 3);
      multiplyOp(vm);
      expect(getStackData(vm)).toEqual([-15]);
    });

    test('should multiply by zero', () => {
      push(vm, 5);
      push(vm, 0);
      multiplyOp(vm);
      expect(getStackData(vm)).toEqual([0]);
    });

    test('should divide two numbers correctly', () => {
      push(vm, 10);
      push(vm, 2);
      divideOp(vm);
      expect(getStackData(vm)).toEqual([5]);
    });

    test('should divide with decimal result', () => {
      push(vm, 10);
      push(vm, 3);
      divideOp(vm);
      expect(pop(vm)).toBeCloseTo(3.33333, 4);
    });

    test('should divide negative numbers', () => {
      push(vm, -10);
      push(vm, 2);
      divideOp(vm);
      expect(getStackData(vm)).toEqual([-5]);
    });

    test('should handle division by zero', () => {
      push(vm, 5);
      push(vm, 0);
      divideOp(vm);
      expect(getStackData(vm)).toEqual([Infinity]);
    });

    test('should calculate power correctly', () => {
      push(vm, 2);
      push(vm, 3);
      powOp(vm);
      expect(getStackData(vm)).toEqual([8]);
    });

    test('should handle fractional exponents', () => {
      push(vm, 4);
      push(vm, 0.5);
      powOp(vm);
      expect(getStackData(vm)).toEqual([2]);
    });

    test('should handle negative base', () => {
      push(vm, -2);
      push(vm, 2);
      powOp(vm);
      expect(getStackData(vm)).toEqual([4]);
    });

    test('should handle zero base', () => {
      push(vm, 0);
      push(vm, 5);
      powOp(vm);
      expect(getStackData(vm)).toEqual([0]);
    });

    test('should calculate modulo correctly', () => {
      push(vm, 10);
      push(vm, 3);
      modOp(vm);
      expect(getStackData(vm)).toEqual([1]);
    });

    test('should handle negative modulo', () => {
      push(vm, -10);
      push(vm, 3);
      modOp(vm);
      expect(getStackData(vm)).toEqual([-1]);
    });

    test('should handle zero modulus', () => {
      push(vm, 5);
      push(vm, 0);
      modOp(vm);
      expect(pop(vm)).toBeNaN();
    });

    test('should return minimum value', () => {
      push(vm, 10);
      push(vm, 5);
      minOp(vm);
      expect(getStackData(vm)).toEqual([5]);
    });

    test('should handle negative min values', () => {
      push(vm, -5);
      push(vm, -10);
      minOp(vm);
      expect(getStackData(vm)).toEqual([-10]);
    });

    test('should return maximum value', () => {
      push(vm, 10);
      push(vm, 5);
      maxOp(vm);
      expect(getStackData(vm)).toEqual([10]);
    });

    test('should handle negative max values', () => {
      push(vm, -5);
      push(vm, -10);
      maxOp(vm);
      expect(getStackData(vm)).toEqual([-5]);
    });

    test('should return absolute value', () => {
      push(vm, -5);
      absOp(vm);
      expect(getStackData(vm)).toEqual([5]);
    });

    test('should return same value for positive absolute', () => {
      push(vm, 10);
      absOp(vm);
      expect(getStackData(vm)).toEqual([10]);
    });

    test('should handle zero absolute', () => {
      push(vm, 0);
      absOp(vm);
      expect(getStackData(vm)).toEqual([0]);
    });

    test('should negate positive number', () => {
      push(vm, 5);
      negOp(vm);
      expect(getStackData(vm)).toEqual([-5]);
    });

    test('should negate negative number', () => {
      push(vm, -3);
      negOp(vm);
      expect(getStackData(vm)).toEqual([3]);
    });

    test('should handle zero negation', () => {
      push(vm, 0);
      negOp(vm);
      expect(getStackData(vm)).toEqual([-0]);
    });

    test('should return sign of positive number', () => {
      push(vm, 5);
      signOp(vm);
      expect(getStackData(vm)).toEqual([1]);
    });

    test('should return sign of negative number', () => {
      push(vm, -3);
      signOp(vm);
      expect(getStackData(vm)).toEqual([-1]);
    });

    test('should return sign of zero', () => {
      push(vm, 0);
      signOp(vm);
      expect(getStackData(vm)).toEqual([0]);
    });

    test('should calculate square root', () => {
      push(vm, 16);
      sqrtOp(vm);
      expect(getStackData(vm)).toEqual([4]);
    });

    test('should handle zero square root', () => {
      push(vm, 0);
      sqrtOp(vm);
      expect(getStackData(vm)).toEqual([0]);
    });

    test('should calculate exponential', () => {
      push(vm, 1);
      expOp(vm);
      expect(pop(vm)).toBeCloseTo(Math.E, 5);
    });

    test('should calculate natural logarithm', () => {
      push(vm, Math.E);
      lnOp(vm);
      expect(pop(vm)).toBeCloseTo(1, 5);
    });

    test('should calculate log base 10', () => {
      push(vm, 100);
      logOp(vm);
      expect(pop(vm)).toBeCloseTo(2, 5);
    });
  });

  describe('error cases', () => {
    test('should throw on add stack underflow', () => {
      push(vm, 5);
      expect(() => addOp(vm)).toThrow('Stack underflow');
    });

    test('should throw on subtract stack underflow', () => {
      push(vm, 5);
      expect(() => subtractOp(vm)).toThrow('Stack underflow');
    });

    test('should throw on multiply stack underflow', () => {
      push(vm, 5);
      expect(() => multiplyOp(vm)).toThrow('Stack underflow');
    });

    test('should throw on divide stack underflow', () => {
      push(vm, 5);
      expect(() => divideOp(vm)).toThrow('Stack underflow');
    });

    test('should throw on power stack underflow', () => {
      push(vm, 5);
      expect(() => powOp(vm)).toThrow('Stack underflow');
    });

    test('should throw on modulo stack underflow', () => {
      push(vm, 5);
      expect(() => modOp(vm)).toThrow('Stack underflow');
    });

    test('should throw on min stack underflow', () => {
      push(vm, 5);
      expect(() => minOp(vm)).toThrow('Stack underflow');
    });

    test('should throw on max stack underflow', () => {
      push(vm, 5);
      expect(() => maxOp(vm)).toThrow('Stack underflow');
    });
  });

  describe('integration tests', () => {
    test('should handle add operation with Tacit syntax', () => {
      executeProgram('5 3 add');
      expect(getStackData(vm)).toEqual([8]);
    });

    test('should handle sub operation with Tacit syntax', () => {
      executeProgram('10 4 sub');
      expect(getStackData(vm)).toEqual([6]);
    });

    test('should handle mul operation with Tacit syntax', () => {
      executeProgram('5 4 mul');
      expect(getStackData(vm)).toEqual([20]);
    });

    test('should handle div operation with Tacit syntax', () => {
      executeProgram('10 2 div');
      expect(getStackData(vm)).toEqual([5]);
    });

    test('should handle min operation with Tacit syntax', () => {
      executeProgram('10 5 min');
      expect(getStackData(vm)).toEqual([5]);
      resetVM();
      executeProgram('3 8 min');
      expect(getStackData(vm)).toEqual([3]);
    });

    test('should handle max operation with Tacit syntax', () => {
      executeProgram('10 5 max');
      expect(getStackData(vm)).toEqual([10]);
      resetVM();
      executeProgram('3 8 max');
      expect(getStackData(vm)).toEqual([8]);
    });

    test('should handle pow operation with Tacit syntax', () => {
      executeProgram('2 3 pow');
      expect(getStackData(vm)).toEqual([8]);
    });

    test('should handle eq operation with Tacit syntax', () => {
      executeProgram('5 5 eq');
      expect(getStackData(vm)).toEqual([1]);
      resetVM();
      executeProgram('5 6 eq');
      expect(getStackData(vm)).toEqual([0]);
    });

    test('should handle lt operation with Tacit syntax', () => {
      executeProgram('5 10 lt');
      expect(getStackData(vm)).toEqual([1]);
      resetVM();
      executeProgram('10 5 lt');
      expect(getStackData(vm)).toEqual([0]);
      resetVM();
      executeProgram('5 5 lt');
      expect(getStackData(vm)).toEqual([0]);
    });

    test('should handle le operation with Tacit syntax', () => {
      executeProgram('5 10 le');
      expect(getStackData(vm)).toEqual([1]);
      resetVM();
      executeProgram('10 5 le');
      expect(getStackData(vm)).toEqual([0]);
      resetVM();
      executeProgram('5 5 le');
      expect(getStackData(vm)).toEqual([1]);
    });

    test('should handle gt operation with Tacit syntax', () => {
      executeProgram('10 5 gt');
      expect(getStackData(vm)).toEqual([1]);
      resetVM();
      executeProgram('5 10 gt');
      expect(getStackData(vm)).toEqual([0]);
      resetVM();
      executeProgram('5 5 gt');
      expect(getStackData(vm)).toEqual([0]);
    });

    test('should handle ge operation with Tacit syntax', () => {
      executeProgram('10 5 ge');
      expect(getStackData(vm)).toEqual([1]);
      resetVM();
      executeProgram('5 10 ge');
      expect(getStackData(vm)).toEqual([0]);
      resetVM();
      executeProgram('5 5 ge');
      expect(getStackData(vm)).toEqual([1]);
    });

    test('should handle mod operation with Tacit syntax', () => {
      executeProgram('10 3 mod');
      expect(getStackData(vm)).toEqual([1]);
      resetVM();
      executeProgram('10 5 mod');
      expect(getStackData(vm)).toEqual([0]);
    });
  });
});

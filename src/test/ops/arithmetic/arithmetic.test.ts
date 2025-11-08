import { createVM, VM } from '../../../core';
import { executeTacitCode } from '../../utils/vm-test-utils';
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

describe('Arithmetic Operations', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM();
  });

  describe('binary operations', () => {
    test('add - basic operations', () => {
      push(vm, 5);
      push(vm, 3);
      addOp(vm);
      expect(getStackData(vm)).toEqual([8]);

      vm = createVM();
      push(vm, -5);
      push(vm, 10);
      addOp(vm);
      expect(getStackData(vm)).toEqual([5]);
    });

    test('subtract - basic operations', () => {
      push(vm, 10);
      push(vm, 4);
      subtractOp(vm);
      expect(getStackData(vm)).toEqual([6]);

      vm = createVM();
      push(vm, 5);
      push(vm, 10);
      subtractOp(vm);
      expect(getStackData(vm)).toEqual([-5]);
    });

    test('multiply - basic operations', () => {
      push(vm, 5);
      push(vm, 3);
      multiplyOp(vm);
      expect(getStackData(vm)).toEqual([15]);

      vm = createVM();
      push(vm, -5);
      push(vm, 3);
      multiplyOp(vm);
      expect(getStackData(vm)).toEqual([-15]);

      vm = createVM();
      push(vm, 5);
      push(vm, 0);
      multiplyOp(vm);
      expect(getStackData(vm)).toEqual([0]);
    });

    test('divide - basic operations', () => {
      push(vm, 10);
      push(vm, 2);
      divideOp(vm);
      expect(getStackData(vm)).toEqual([5]);

      vm = createVM();
      push(vm, 7);
      push(vm, 2);
      divideOp(vm);
      expect(pop(vm)).toBeCloseTo(3.5, 5);
    });

    test('power - basic operations', () => {
      push(vm, 2);
      push(vm, 3);
      powOp(vm);
      expect(getStackData(vm)).toEqual([8]);

      vm = createVM();
      push(vm, 4);
      push(vm, 0.5);
      powOp(vm);
      expect(pop(vm)).toBeCloseTo(2, 5);
    });

    test('modulo - basic operations', () => {
      push(vm, 10);
      push(vm, 3);
      modOp(vm);
      expect(getStackData(vm)).toEqual([1]);

      vm = createVM();
      push(vm, -10);
      push(vm, 3);
      modOp(vm);
      expect(pop(vm)).toBeCloseTo(-1, 5);
    });

    test('min/max - basic operations', () => {
      push(vm, 5);
      push(vm, 10);
      minOp(vm);
      expect(getStackData(vm)).toEqual([5]);

      vm = createVM();
      push(vm, 5);
      push(vm, 10);
      maxOp(vm);
      expect(getStackData(vm)).toEqual([10]);
    });
  });

  describe('unary operations', () => {
    test('absolute value', () => {
      push(vm, -5);
      absOp(vm);
      expect(getStackData(vm)).toEqual([5]);

      vm = createVM();
      push(vm, 10);
      absOp(vm);
      expect(getStackData(vm)).toEqual([10]);
    });

    test('negate', () => {
      push(vm, 5);
      negOp(vm);
      expect(getStackData(vm)).toEqual([-5]);

      vm = createVM();
      push(vm, -3);
      negOp(vm);
      expect(getStackData(vm)).toEqual([3]);
    });

    test('sign', () => {
      push(vm, 5);
      signOp(vm);
      expect(getStackData(vm)).toEqual([1]);

      vm = createVM();
      push(vm, -3);
      signOp(vm);
      expect(getStackData(vm)).toEqual([-1]);

      vm = createVM();
      push(vm, 0);
      signOp(vm);
      expect(getStackData(vm)).toEqual([0]);
    });

    test('square root', () => {
      push(vm, 16);
      sqrtOp(vm);
      expect(getStackData(vm)).toEqual([4]);

      vm = createVM();
      push(vm, 0);
      sqrtOp(vm);
      expect(getStackData(vm)).toEqual([0]);
    });

    test('exponential and logarithms', () => {
      push(vm, 1);
      expOp(vm);
      expect(pop(vm)).toBeCloseTo(Math.E, 5);

      vm = createVM();
      push(vm, Math.E);
      lnOp(vm);
      expect(pop(vm)).toBeCloseTo(1, 5);

      vm = createVM();
      push(vm, 100);
      logOp(vm);
      expect(pop(vm)).toBeCloseTo(2, 5);
    });
  });

  describe('error cases', () => {
    test('should throw on stack underflow for binary operations', () => {
      const binaryOps = [
        { op: addOp, name: 'add' },
        { op: subtractOp, name: 'subtract' },
        { op: multiplyOp, name: 'multiply' },
        { op: divideOp, name: 'divide' },
        { op: powOp, name: 'power' },
        { op: modOp, name: 'modulo' },
        { op: minOp, name: 'min' },
        { op: maxOp, name: 'max' },
      ];

      binaryOps.forEach(({ op, name }) => {
        vm = createVM();
        push(vm, 5);
        expect(() => op(vm)).toThrow('Stack underflow');
      });
    });

    test('should throw on stack underflow for unary operations', () => {
      const unaryOps = [
        { op: absOp, name: 'abs' },
        { op: negOp, name: 'neg' },
        { op: signOp, name: 'sign' },
        { op: sqrtOp, name: 'sqrt' },
        { op: expOp, name: 'exp' },
        { op: lnOp, name: 'ln' },
        { op: logOp, name: 'log' },
      ];

      unaryOps.forEach(({ op, name }) => {
        vm = createVM();
        expect(() => op(vm)).toThrow('Stack underflow');
      });
    });

    test('should handle division by zero', () => {
      push(vm, 10);
      push(vm, 0);
      divideOp(vm);
      const result = pop(vm);
      // Division by zero returns Infinity in JavaScript
      expect(result).toBe(Infinity);
    });
  });
});

import { describe, beforeEach } from '@jest/globals';
import { resetVM } from '../../utils/test-utils';
import { OperationType, testOperationGroup } from '../../utils/operations-test-utils';

describe('Basic Arithmetic Operations', () => {
  beforeEach(() => {
    resetVM();
  });

  testOperationGroup(OperationType.Arithmetic, [
    {
      code: '5 3 add',
      expected: [8],
      description: 'should add two positive integers',
    },
    {
      code: '10 -5 add',
      expected: [5],
      description: 'should add positive and negative integers',
    },
    {
      code: '-3 -2 add',
      expected: [-5],
      description: 'should add two negative integers',
    },
    {
      code: '0 0 add',
      expected: [0],
      description: 'should handle zero values in addition',
    },
  ]);

  testOperationGroup('subtraction', [
    {
      code: '10 3 sub',
      expected: [7],
      description: 'should subtract a smaller positive from larger positive',
    },
    {
      code: '5 10 sub',
      expected: [-5],
      description: 'should subtract a larger positive from smaller positive',
    },
    {
      code: '-3 -8 sub',
      expected: [5],
      description: 'should subtract a negative from a negative',
    },
  ]);

  testOperationGroup('multiplication', [
    {
      code: '5 3 mul',
      expected: [15],
      description: 'should multiply two positive integers',
    },
    {
      code: '6 -4 mul',
      expected: [-24],
      description: 'should multiply positive and negative integers',
    },
    {
      code: '-2 -3 mul',
      expected: [6],
      description: 'should multiply two negative integers',
    },
  ]);

  testOperationGroup('division', [
    {
      code: '15 3 div',
      expected: [5],
      description: 'should divide evenly',
    },
    {
      code: '10 3 div',
      expected: [3.3333332538604736],
      description: 'should perform floating-point division',
    },
    {
      code: '-12 4 div',
      expected: [-3],
      description: 'should handle negative dividend',
    },
  ]);
});

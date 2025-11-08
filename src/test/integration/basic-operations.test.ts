import { describe, test, expect, beforeEach } from '@jest/globals';
import { createVM, VM } from '../../core';
import { runTacitTest } from '../utils/vm-test-utils';

describe('Tacit Basic Operations - Integration', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM();
  });

  // Only keep multi-operation integration tests - single operations are tested in unit tests
  test('multiple operations in sequence', () => {
    const result = runTacitTest(vm, '5 3 add 2 mul 10 sub');
    expect(result).toEqual([6]); // (5+3)*2-10 = 6
  });

  test('if operator with multiple operations', () => {
    let result = runTacitTest(vm, '1 if 5 3 add else 10 2 mul ;');
    expect(result).toEqual([8]);
    result = runTacitTest(vm, '0 if 5 3 add else 10 2 mul ;');
    expect(result).toEqual([20]);
  });
});

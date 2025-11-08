import { describe, test, expect, beforeEach } from '@jest/globals';
import { createVM, VM } from '../../core';
import { runTacitTest } from '../utils/vm-test-utils';

describe('Tacit Advanced Operations', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM();
  });

  test('word definitions', () => {
    let result = runTacitTest(vm, ': square dup mul ; 3 square');
    expect(result).toEqual([9]);
    result = runTacitTest(vm, ': double 2 mul ; : quadruple double double ; 5 quadruple');
    expect(result).toEqual([20]);
    result = runTacitTest(vm, ': swap-and-add swap add ; 3 7 swap-and-add');
    expect(result).toEqual([10]);
  });
  test('complex conditions', () => {
    let result = runTacitTest(vm, '1 if 2 else 3 ;');
    expect(result).toEqual([2]);
  });
  test('nested if expressions', () => {
    let result = runTacitTest(vm, '1 if 5 2 add else 8 3 sub ;');
    expect(result).toEqual([7]);
  });
});

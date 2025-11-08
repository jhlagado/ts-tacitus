import { describe, test, expect, beforeEach } from '@jest/globals';
import { createVM, VM } from '../../core';
import { runTacitTest } from '../utils/vm-test-utils';

describe('Tacit Basic Operations', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM();
  });

  test('arithmetic operations', () => {
    let result = runTacitTest(vm, '5 3 add');
    expect(result).toEqual([8]);
    result = runTacitTest(vm, '10 3 sub');
    expect(result).toEqual([7]);
    result = runTacitTest(vm, '5 3 mul');
    expect(result).toEqual([15]);
    result = runTacitTest(vm, '15 3 div');
    expect(result).toEqual([5]);
  });
  test('stack operations', () => {
    let result = runTacitTest(vm, '5 dup');
    expect(result).toEqual([5, 5]);
    result = runTacitTest(vm, '5 3 drop');
    expect(result).toEqual([5]);
    result = runTacitTest(vm, '5 3 swap');
    expect(result).toEqual([3, 5]);
  });
  test('comparison operations', () => {
    let result = runTacitTest(vm, '10 5 gt');
    expect(result).toEqual([1]);
    result = runTacitTest(vm, '5 10 gt');
    expect(result).toEqual([0]);
    result = runTacitTest(vm, '5 5 eq');
    expect(result).toEqual([1]);
    result = runTacitTest(vm, '5 6 eq');
    expect(result).toEqual([0]);
  });
  test('if operator (new immediate syntax)', () => {
    let result = runTacitTest(vm, '1 if 10 else 20 ;');
    expect(result).toEqual([10]);
    result = runTacitTest(vm, '0 if 10 else 20 ;');
    expect(result).toEqual([20]);
  });
  test('bare string shorthand with apostrophe', () => {
    const result = runTacitTest(vm, "'testWord");
    expect(result.length).toBe(1);
    expect(typeof result[0]).toBe('number'); // tagged STRING value
  });

  test('should execute if with true condition', () => {
    let result = runTacitTest(vm, '1 if 10 ;');
    expect(result).toEqual([10]);
  });
  test('should execute if with false condition', () => {
    let result = runTacitTest(vm, '0 if 10 ;');
    expect(result).toEqual([]);
  });
  test('should execute if/else with true condition', () => {
    let result = runTacitTest(vm, '1 if 10 else 20 ;');
    expect(result).toEqual([10]);
  });
  test('should execute if/else with false condition', () => {
    let result = runTacitTest(vm, '0 if 10 else 20 ;');
    expect(result).toEqual([20]);
  });
});

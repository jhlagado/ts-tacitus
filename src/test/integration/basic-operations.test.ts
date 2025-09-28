import { runTacitTest } from '../utils/vm-test-utils';

describe('Tacit Basic Operations', () => {
  test('arithmetic operations', () => {
    let result = runTacitTest('5 3 add');
    expect(result).toEqual([8]);
    result = runTacitTest('10 3 sub');
    expect(result).toEqual([7]);
    result = runTacitTest('5 3 mul');
    expect(result).toEqual([15]);
    result = runTacitTest('15 3 div');
    expect(result).toEqual([5]);
  });
  test('stack operations', () => {
    let result = runTacitTest('5 dup');
    expect(result).toEqual([5, 5]);
    result = runTacitTest('5 3 drop');
    expect(result).toEqual([5]);
    result = runTacitTest('5 3 swap');
    expect(result).toEqual([3, 5]);
  });
  test('comparison operations', () => {
    let result = runTacitTest('10 5 gt');
    expect(result).toEqual([1]);
    result = runTacitTest('5 10 gt');
    expect(result).toEqual([0]);
    result = runTacitTest('5 5 eq');
    expect(result).toEqual([1]);
    result = runTacitTest('5 6 eq');
    expect(result).toEqual([0]);
  });
  test('if operator (new immediate syntax)', () => {
    let result = runTacitTest('1 if 10 else 20 ;');
    expect(result).toEqual([10]);
    result = runTacitTest('0 if 10 else 20 ;');
    expect(result).toEqual([20]);
  });
  test('word quoting with back-tick', () => {
    let result = runTacitTest(': testWord 42 ; `testWord');
    expect(result.length).toBe(1);
    expect(typeof result[0]).toBe('number');
  });

  test('should execute if with true condition', () => {
    let result = runTacitTest('1 if 10 ;');
    expect(result).toEqual([10]);
  });
  test('should execute if with false condition', () => {
    let result = runTacitTest('0 if 10 ;');
    expect(result).toEqual([]);
  });
  test('should execute if/else with true condition', () => {
    let result = runTacitTest('1 if 10 else 20 ;');
    expect(result).toEqual([10]);
  });
  test('should execute if/else with false condition', () => {
    let result = runTacitTest('0 if 10 else 20 ;');
    expect(result).toEqual([20]);
  });
});

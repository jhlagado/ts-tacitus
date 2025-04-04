import { runTacitTest } from '../utils/tacitTestUtils';

describe('Tacit Basic Operations', () => {
  test('arithmetic operations', () => {
    // Addition
    let result = runTacitTest('5 3 +');
    expect(result).toEqual([8]);

    // Subtraction
    result = runTacitTest('10 3 -');
    expect(result).toEqual([7]);

    // Multiplication
    result = runTacitTest('5 3 *');
    expect(result).toEqual([15]);

    // Division
    result = runTacitTest('15 3 /');
    expect(result).toEqual([5]);
  });

  test('stack operations', () => {
    // Duplicate
    let result = runTacitTest('5 dup');
    expect(result).toEqual([5, 5]);

    // Drop
    result = runTacitTest('5 3 drop');
    expect(result).toEqual([5]);

    // Swap
    result = runTacitTest('5 3 swap');
    expect(result).toEqual([3, 5]);
  });

  test('comparison operations', () => {
    // Greater than (true)
    let result = runTacitTest('10 5 >');
    expect(result).toEqual([1]);

    // Greater than (false)
    result = runTacitTest('5 10 >');
    expect(result).toEqual([0]);

    // Equal (true)
    result = runTacitTest('5 5 =');
    expect(result).toEqual([1]);

    // Equal (false)
    result = runTacitTest('5 6 =');
    expect(result).toEqual([0]);
  });

  test('if operator', () => {
    // Basic if - true branch
    let result = runTacitTest('1 (10) (20) if');
    expect(result).toEqual([10]);

    // Basic if - false branch
    result = runTacitTest('0 (10) (20) if');
    expect(result).toEqual([20]);
  });

  test('eval operator', () => {
    // Simple eval
    let result = runTacitTest('(42) eval');
    expect(result).toEqual([42]);

    // Eval with arithmetic
    result = runTacitTest('(5 7 +) eval');
    expect(result).toEqual([12]);

    // Using a value before the code block
    result = runTacitTest('2 (3 *) eval');
    expect(result).toEqual([6]);
  });
});

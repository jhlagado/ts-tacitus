import { runTacitTest } from '../tacitTestUtils';

describe('Tacit Basic Operations', () => {
  test('arithmetic operations', () => {
    // Test addition, subtraction, multiplication, division
    let result = runTacitTest('5 3 +');
    expect(result).toEqual([8]);

    result = runTacitTest('10 4 -');
    expect(result).toEqual([6]);

    result = runTacitTest('7 3 *');
    expect(result).toEqual([21]);

    result = runTacitTest('15 3 /');
    expect(result).toEqual([5]);
  });

  test('stack manipulation', () => {
    // Test dup, drop, swap
    let result = runTacitTest('5 dup');
    expect(result).toEqual([5, 5]);

    result = runTacitTest('5 drop');
    expect(result).toEqual([]);

    result = runTacitTest('5 3 swap');
    expect(result).toEqual([3, 5]);
  });

  test('comparison operators', () => {
    // Test =, <, >
    let result = runTacitTest('5 5 =');
    expect(result).toEqual([1]);

    result = runTacitTest('5 3 >');
    expect(result).toEqual([1]);

    result = runTacitTest('3 5 <');
    expect(result).toEqual([1]);
  });

  // Logical operators test removed - not yet implemented
});

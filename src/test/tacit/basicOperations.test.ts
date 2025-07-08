import { runTacitTest } from '../tacitTestUtils';

describe('Tacit Basic Operations', () => {
  test('arithmetic operations', () => {
    // Addition
    let result = runTacitTest('5 3 add');
    expect(result).toEqual([8]);

    // Subtraction
    result = runTacitTest('10 3 sub');
    expect(result).toEqual([7]);

    // Multiplication
    result = runTacitTest('5 3 mult');
    expect(result).toEqual([15]);

    // Division
    result = runTacitTest('15 3 div');
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
    let result = runTacitTest('10 5 gt');
    expect(result).toEqual([1]);

    // Greater than (false)
    result = runTacitTest('5 10 gt');
    expect(result).toEqual([0]);

    // Equal (true)
    result = runTacitTest('5 5 eq');
    expect(result).toEqual([1]);

    // Equal (false)
    result = runTacitTest('5 6 eq');
    expect(result).toEqual([0]);
  });

  test('if operator (using new IF syntax)', () => {
    // Basic if - true branch
    let result = runTacitTest('1 IF {10} ELSE {20}');
    expect(result).toEqual([10]);
    
    // Basic if - false branch
    result = runTacitTest('0 IF {10} ELSE {20}');
    expect(result).toEqual([20]);
  });

  test('word quoting with back-tick', () => {
    let result = runTacitTest(': testWord 42 ; `testWord');
    expect(result.length).toBe(1); // Expect one item (address on stack)
    expect(typeof result[0]).toBe('number'); // Address should be a number
  });
});

describe('New IF syntax', () => {
  it('should execute IF {} with true condition', () => {
    let result = runTacitTest('1 IF {10}');
    expect(result).toEqual([10]);
  });

  it('should execute IF {} with false condition', () => {
    let result = runTacitTest('0 IF {10}');
    expect(result).toEqual([]); // Assuming no else, stack might be empty or handle appropriately
  });

  it('should execute IF {} ELSE {} with true condition', () => {
    let result = runTacitTest('1 IF {10} ELSE {20}');
    expect(result).toEqual([10]);
  });

  it('should execute IF {} ELSE {} with false condition', () => {
    let result = runTacitTest('0 IF {10} ELSE {20}');
    expect(result).toEqual([20]);
  });
});

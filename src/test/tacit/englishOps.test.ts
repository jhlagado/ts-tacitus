import { runTacitTest } from '../tacitTestUtils';

describe('Tacit English Word Operations', () => {
  // Test both the symbolic and English word versions of monadic operations

  test('negate operation', () => {
    // Test both m- (symbolic) and neg (word)
    let result = runTacitTest('5 m-');
    expect(result).toEqual([-5]);

    result = runTacitTest('5 neg');
    expect(result).toEqual([-5]);
  });

  test('reciprocal operation', () => {
    // Test both m% (symbolic) and recip (word)
    let result = runTacitTest('4 m%');
    expect(result).toEqual([0.25]);

    result = runTacitTest('4 recip');
    expect(result).toEqual([0.25]);
  });

  test('floor operation', () => {
    // Test both m_ (symbolic) and floor (word)
    let result = runTacitTest('5.7 m_');
    expect(result).toEqual([5]);

    result = runTacitTest('5.7 floor');
    expect(result).toEqual([5]);

    // Test negative number
    result = runTacitTest('-2.3 floor');
    expect(result).toEqual([-3]);
  });

  test('not operation', () => {
    // Test both m~ (symbolic) and not (word)
    let result = runTacitTest('0 m~');
    expect(result).toEqual([1]);

    result = runTacitTest('1 not');
    expect(result).toEqual([0]);

    result = runTacitTest('5 not');
    expect(result).toEqual([0]);
  });

  test('signum operation', () => {
    // Test both m* (symbolic) and sign (word)
    let result = runTacitTest('5 m*');
    expect(result).toEqual([1]);

    result = runTacitTest('5 sign');
    expect(result).toEqual([1]);

    result = runTacitTest('-3 sign');
    expect(result).toEqual([-1]);

    result = runTacitTest('0 sign');
    expect(result).toEqual([0]);
  });

  test('enlist operation', () => {
    // Test both m, (symbolic) and enlist (word)
    // In the VM implementation, a tuple consists of multiple values on the stack:
    // - a tuple tag with the size
    // - the element(s) of the tuple
    
    let result = runTacitTest('5 m,');
    expect(result.length).toBe(2); // Tuple tag + the element
    
    result = runTacitTest('5 enlist');
    expect(result.length).toBe(2);
  });
});

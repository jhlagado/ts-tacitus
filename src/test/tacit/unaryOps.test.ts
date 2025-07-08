import { runTacitTest } from '../tacitTestUtils';

describe('Tacit Unary Op Operations', () => {
  test('negate operation', () => {
    const result = runTacitTest('5 neg');
    expect(result).toEqual([-5]);
  });
  test('reciprocal operation', () => {
    const result = runTacitTest('4 recip');
    expect(result).toEqual([0.25]);
  });
  test('floor operation', () => {
    let result = runTacitTest('5.7 floor');
    expect(result).toEqual([5]);
    result = runTacitTest('-2.3 floor');
    expect(result).toEqual([-3]);
  });
  test('not operation', () => {
    let result = runTacitTest('0 not');
    expect(result).toEqual([1]);
    result = runTacitTest('1 not');
    expect(result).toEqual([0]);
    result = runTacitTest('5 not');
    expect(result).toEqual([0]);
  });
  test('signum operation', () => {
    let result = runTacitTest('5 sign');
    expect(result).toEqual([1]);
    result = runTacitTest('-3 sign');
    expect(result).toEqual([-1]);
    result = runTacitTest('0 sign');
    expect(result).toEqual([0]);
  });
  test('enlist operation', () => {
    const result = runTacitTest('5 enlist');
    expect(result.length).toBe(2);
  });
});

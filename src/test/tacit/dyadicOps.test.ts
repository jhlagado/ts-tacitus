import { runTacitTest } from '../tacitTestUtils';

describe('Tacit Binary Op Operations', () => {
  // Tests for binary op operations with English word names
  
  test('add operation', () => {
    const result = runTacitTest('5 3 add');
    expect(result).toEqual([8]);
  });

  test('sub operation', () => {
    const result = runTacitTest('10 4 sub');
    expect(result).toEqual([6]);
  });

  test('mult operation', () => {
    const result = runTacitTest('5 4 mult');
    expect(result).toEqual([20]);
  });

  test('div operation', () => {
    const result = runTacitTest('10 2 div');
    expect(result).toEqual([5]);
  });

  test('min operation', () => {
    let result = runTacitTest('10 5 min');
    expect(result).toEqual([5]);
    
    result = runTacitTest('3 8 min');
    expect(result).toEqual([3]);
  });

  test('max operation', () => {
    let result = runTacitTest('10 5 max');
    expect(result).toEqual([10]);
    
    result = runTacitTest('3 8 max');
    expect(result).toEqual([8]);
  });

  test('pow operation', () => {
    const result = runTacitTest('2 3 pow');
    expect(result).toEqual([8]);
  });

  test('eq operation', () => {
    let result = runTacitTest('5 5 eq');
    expect(result).toEqual([1]);
    
    result = runTacitTest('5 6 eq');
    expect(result).toEqual([0]);
  });

  test('lt operation', () => {
    let result = runTacitTest('5 10 lt');
    expect(result).toEqual([1]);
    
    result = runTacitTest('10 5 lt');
    expect(result).toEqual([0]);
    
    result = runTacitTest('5 5 lt');
    expect(result).toEqual([0]);
  });

  test('le operation', () => {
    let result = runTacitTest('5 10 le');
    expect(result).toEqual([1]);
    
    result = runTacitTest('10 5 le');
    expect(result).toEqual([0]);
    
    result = runTacitTest('5 5 le');
    expect(result).toEqual([1]);
  });

  test('gt operation', () => {
    let result = runTacitTest('10 5 gt');
    expect(result).toEqual([1]);
    
    result = runTacitTest('5 10 gt');
    expect(result).toEqual([0]);
    
    result = runTacitTest('5 5 gt');
    expect(result).toEqual([0]);
  });

  test('ge operation', () => {
    let result = runTacitTest('10 5 ge');
    expect(result).toEqual([1]);
    
    result = runTacitTest('5 10 ge');
    expect(result).toEqual([0]);
    
    result = runTacitTest('5 5 ge');
    expect(result).toEqual([1]);
  });

  test('mod operation', () => {
    let result = runTacitTest('10 3 mod');
    expect(result).toEqual([1]);
    
    result = runTacitTest('10 5 mod');
    expect(result).toEqual([0]);
  });
});

import { runTacitTest } from '../tacitTestUtils';

describe('Tacit Advanced Operations', () => {
  test('word definitions', () => {
    // Simple definition
    let result = runTacitTest(': square dup mult ; 3 square');
    expect(result).toEqual([9]);

    // Definition using another definition
    result = runTacitTest(': double 2 mult ; : quadruple double double ; 5 quadruple');
    expect(result).toEqual([20]);

    // Definition with stack manipulation
    result = runTacitTest(': swap-and-add swap add ; 3 7 swap-and-add');
    expect(result).toEqual([10]);
  });

  test('complex conditions', () => {
    // Simple if using new syntax
    let result = runTacitTest('1 IF { 2 } ELSE { 3 }');
    expect(result).toEqual([2]);
  });

  test('nested if with code blocks (using new IF syntax)', () => {
    // Advanced if: if clauses with expressions
    let result = runTacitTest('1 IF { 5 2 add } ELSE { 8 3 sub }');
    expect(result).toEqual([7]);
  });


});

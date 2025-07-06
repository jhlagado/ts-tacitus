import { runTacitTest } from '../tacitTestUtils';

describe('Tacit Advanced Operations', () => {
  test('word definitions', () => {
    // Simple definition
    let result = runTacitTest(': square dup * ; 3 square');
    expect(result).toEqual([9]);

    // Definition using another definition
    result = runTacitTest(': double 2 * ; : quadruple double double ; 5 quadruple');
    expect(result).toEqual([20]);

    // Definition with stack manipulation
    result = runTacitTest(': swap-and-add swap + ; 3 7 swap-and-add');
    expect(result).toEqual([10]);
  });

  test('complex conditions', () => {
    // Simple if
    let result = runTacitTest('1 (2) (3) if');
    expect(result).toEqual([2]);
  });

  test('nested if with code blocks (using new IF syntax)', () => {
    // Advanced if: if clauses with expressions
    let result = runTacitTest('1 IF { 5 2 + } ELSE { 8 3 - }');
    expect(result).toEqual([7]);
  });


});

import { runTacitTest } from '../utils/tacitTestUtils';

describe('Tacit Advanced Operations', () => {
  test('code blocks', () => {
    // Simple code block execution
    let result = runTacitTest('(30 20 *) eval');
    expect(result).toEqual([600]);

    // Nested code blocks
    result = runTacitTest('((4 2 +) eval (3 2 +) eval *) eval');
    expect(result).toEqual([30]);

    // Code block with stack operations
    result = runTacitTest('4 (3 2 *) eval +');
    expect(result).toEqual([10]);
  });

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

  test('nested if with code blocks', () => {
    // Advanced if: if clauses with expressions
    let result = runTacitTest('1 ( 5 2 + ) ( 8 3 - ) if');
    expect(result).toEqual([7]);
  });

  test('eval with stack manipulation', () => {
    // Advanced eval: Evaluate a code block that swaps and adds
    let result = runTacitTest('(3 4 swap +) eval');
    expect(result).toEqual([7]);
  });
});

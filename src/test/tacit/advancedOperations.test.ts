import { runTacitTestSuite } from '../utils/tacitTestUtils';

describe('Tacit Advanced Operations', () => {
  test('code blocks', () => {
    runTacitTestSuite(`
      // Simple code block execution
      (30 20 *) eval => 600

      // Nested code blocks
      ((4 2 +) eval (3 2 +) eval *) eval => 30

      // Code block with stack operations
      4 (3 2 *) eval + => 10
    `);
  });

  test('word definitions', () => {
    runTacitTestSuite(`
      // Simple definition
      : square dup * ;
      3 square => 9

      // Definition using another definition
      : double 2 * ;
      : quadruple double double ;
      5 quadruple => 20

      // Definition with stack manipulation
      : swap-and-add swap + ;
      3 7 swap-and-add => 10
    `);
  });

  test('complex conditions', () => {
    runTacitTestSuite(`
      // simple If
      1 (2) (3) if => 2
    `);
  });

  test('nested if with code blocks', () => {
    runTacitTestSuite(`
      // Advanced if: if clauses with expressions demonstrating.
      1 ( 5 2 + ) ( 8 3 - ) if => 7
    `);
  });

  test('eval with stack manipulation', () => {
    runTacitTestSuite(`
      // Advanced eval: Evaluate a code block that swaps and adds.
      (3 4 swap +) eval => 7
    `);
  });
});

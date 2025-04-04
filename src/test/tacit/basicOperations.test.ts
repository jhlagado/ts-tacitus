import { runTacitTestSuite } from '../utils/tacitTestUtils';

describe('Tacit Basic Operations', () => {
  test('arithmetic operations', () => {
    runTacitTestSuite(`
      // Addition
      5 3 + => 8

      // Subtraction
      10 3 - => 7

      // Multiplication
      5 3 * => 15

      // Division
      15 3 / => 5

      // Complex expression
      5 3 + 2 * => 16
    `);
  });

  test('stack operations', () => {
    runTacitTestSuite(`
      // Duplicate
      5 dup => 5 5

      // Drop
      5 3 drop => 5

      // Swap
      5 3 swap => 3 5

      // Complex manipulation
      1 2 3 drop swap dup => 2 1 1
    `);
  });

  test('comparison operations', () => {
    runTacitTestSuite(`
      // Greater than (true)
      10 5 > => 1

      // Greater than (false)
      5 10 > => 0

      // Equal (true)
      5 5 = => 1

      // Equal (false)
      5 6 = => 0
    `);
  });

  test('if operator', () => {
    runTacitTestSuite(`
      // Basic if - true branch
      1 (10) (20) if => 10

      // Basic if - false branch
      0 (10) (20) if => 20
    `);
  });

  test('eval operator', () => {
    runTacitTestSuite(`
      // Simple eval
      (42) eval => 42

      // Eval with arithmetic
      (5 7 +) eval => 12

      // Using a value before the code block
      2 (3 *) eval => 6
    `);
  });
});

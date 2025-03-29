import { runTacitTestSuite } from './testUtils';

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

      // Complex stack manipulation
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
    // Now that we have fixed the if operator, let's enable the test again
    runTacitTestSuite(`
      // True condition - should execute the then-branch (10)
      1 (10) (20) if => 10

      // False condition - should execute the else-branch (20)
      0 (10) (20) if => 20

      // Complex condition - the result of comparison is used as the condition
      10 5 > (15) (25) if => 15

      // Nested if operations
      1 (2 (30) (40) if) (50) if => 30
    `);
  });

  test('eval operator', () => {
    runTacitTestSuite(`
      // Basic eval - executes a code block
      (42) eval => 42

      // Eval with arithmetic in the code block
      (5 7 +) eval => 12

      // Using a value before the code block
      2 (3 *) eval => 6

      // Alternative syntax for the previous test
      2 3 (*) eval => 6

      // Stack manipulation in code block
      3 4 (swap) eval => 4 3
    `);
  });
});

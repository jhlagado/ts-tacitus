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
    runTacitTestSuite(`
      // True condition - should execute the then-branch (10)
      1 (10) (20) if => 10

      // False condition - should execute the else-branch (20)
      0 (10) (20) if => 20

      // Complex condition - the result of comparison is used as the condition
      10 5 > (15) (25) if => 15

      // Nested if operations
      1 (2 (30) (40) if) (50) if => 30

      // Using regular values instead of code blocks
      1 10 20 if => 10

      // Mix of code and regular values
      1 (15) 20 if => 15
      0 15 (20) if => 20
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

      // Using eval with a regular value should leave it unchanged
      42 eval => 42

      // Mix of code and regular values on stack
      10 (5 +) eval => 15
    `);
  });

  xtest('if operator - complex tests', () => {
    runTacitTestSuite(`
      // Using code blocks as conditions
      (1) (10) (20) if => 10
      (0) (10) (20) if => 20
      (5 4 >) (15) (25) if => 15
      (5 4 <) (15) (25) if => 25

      // Nested if with code block condition
      (5 4 > (0) (1) if) (10) (20) if => 20
    `);
  });

  test('if operator - minimal demonstration', () => {
    runTacitTestSuite(`
      // Basic composite if with deferred condition
      (1 2 <) (100) (200) if => 100
    `);
  });
});

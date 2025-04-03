import { Tokenizer } from '../../core/tokenizer';
import { parse } from '../../core/parser';
import { execute } from '../../core/interpreter';
import { initializeInterpreter, vm } from '../../core/globalState';

/**
 * Execute a Tacit code string and return the stack result
 * @param code The Tacit code to execute
 * @returns Array containing the final stack values
 */
export function executeTacitCode(code: string): number[] {
  // Initialize interpreter state
  initializeInterpreter();

  // Parse and execute the code
  parse(new Tokenizer(code));
  execute(vm.compiler.BP);

  // Return the stack for assertions
  return vm.getStackData();
}

/**
 * Run a tacit code snippet and check that the stack matches expected values
 */
export function testTacitCode(code: string, expectedStack: number[]): void {
  const actualStack = executeTacitCode(code);

  console.log('testTacitCode - Code:', code);
  console.log('testTacitCode - Expected Stack:', JSON.stringify(expectedStack));
  console.log('testTacitCode - Actual Stack:', JSON.stringify(actualStack));

  // Compare stacks
  if (actualStack.length !== expectedStack.length) {
    throw new Error(
      `Stack length mismatch: expected ${expectedStack.length}, got ${actualStack.length}\n` +
        `Expected: ${JSON.stringify(expectedStack)}\n` +
        `Actual: ${JSON.stringify(actualStack)}`
    );
  }

  // Compare each value with appropriate tolerance for floating point
  for (let i = 0; i < actualStack.length; i++) {
    const expected = expectedStack[i];
    const actual = actualStack[i];

    console.log(`testTacitCode - Comparing position ${i}: expected=${expected}, actual=${actual}`);

    // Handle null, undefined, or non-numeric values
    if (actual === null || actual === undefined || typeof actual !== 'number') {
      throw new Error(
        `Stack value type mismatch at position ${i}: expected number ${expected}, got ${typeof actual} ${actual}\n` +
          `Expected: ${JSON.stringify(expectedStack)}\n` +
          `Actual: ${JSON.stringify(actualStack)}`
      );
    }

    // Handle NaN values - if either is NaN, they should not be considered equal
    if (isNaN(actual) || isNaN(expected)) {
      throw new Error(
        `Stack value is NaN at position ${i}: expected ${expected}, got ${actual}\n` +
          `Expected: ${JSON.stringify(expectedStack)}\n` +
          `Actual: ${JSON.stringify(actualStack)}`
      );
    }

    // Use approximate comparison for floating point values
    if (Math.abs(expected - actual) > 0.0001) {
      throw new Error(
        `Stack value mismatch at position ${i}: expected ${expected}, got ${actual}\n` +
          `Expected: ${JSON.stringify(expectedStack)}\n` +
          `Actual: ${JSON.stringify(actualStack)}`
      );
    }
  }
}

/**
 * Execute Tacit code and return output that was printed to console
 * Useful for testing code that uses the '.' operator
 */
export function captureTacitOutput(code: string): string[] {
  // Initialize interpreter
  initializeInterpreter();

  // Capture console output
  const output: string[] = [];
  const originalConsoleLog = console.log;
  console.log = (...args) => {
    output.push(args.join(' '));
  };

  try {
    // Execute the code
    parse(new Tokenizer(code));
    execute(vm.compiler.BP);

    return output;
  } finally {
    // Restore console.log
    console.log = originalConsoleLog;
  }
}

/**
 * Creates a test suite from a template string containing Tacit code
 * Allows writing tests in a more literate programming style
 *
 * Example:
 * ```
 * runTacitTestSuite(`
 *   // Test basic arithmetic
 *   5 3 + => 8
 *
 *   // Test stack operations
 *   5 dup => 5 5
 *
 *   // Test string output
 *   "Hello" . => Hello
 * `);
 * ```
 */
export function runTacitTestSuite(testSuite: string): void {
  const lines = testSuite.split('\n');
  let currentTest = '';
  let lineNumber = 0;

  for (const line of lines) {
    lineNumber++;
    const trimmedLine = line.trim();

    // Skip empty lines and comments
    if (trimmedLine === '' || trimmedLine.startsWith('//')) {
      continue;
    }

    // If this is a test assertion line
    if (trimmedLine.includes('=>')) {
      const [code, expectation] = trimmedLine.split('=>').map(part => part.trim());

      // If we have accumulated code, prepend it
      const fullCode = currentTest + ' ' + code;
      currentTest = ''; // Reset accumulated code

      try {
        // Check if this is testing console output
        if (expectation.includes('.')) {
          const expectedOutput = expectation.replace(/\./g, '').trim();
          const output = captureTacitOutput(fullCode);

          if (!output.includes(expectedOutput)) {
            throw new Error(
              `Output mismatch at line ${lineNumber}:\n` +
                `Expected: "${expectedOutput}"\n` +
                `Actual: "${output.join(', ')}"`
            );
          }
        } else {
          // Otherwise it's testing stack values
          const expectedStack = expectation
            .split(' ')
            .filter(Boolean)
            .map(val => parseFloat(val));

          testTacitCode(fullCode, expectedStack);
        }
      } catch (error) {
        if (error instanceof Error) {
          throw new Error(`Test failed at line ${lineNumber}: ${error.message}`);
        } else {
          throw new Error(`Test failed at line ${lineNumber}: Unknown error`);
        }
      }
    } else {
      // This is code to be accumulated
      currentTest += ' ' + trimmedLine;
    }
  }
}

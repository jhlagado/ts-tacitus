import { Tokenizer } from '../core/tokenizer';
import { parse } from '../core/parser';
import { execute } from '../core/interpreter';
import { initializeInterpreter, vm } from '../core/globalState';

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
    originalConsoleLog(...args);
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
 * Execute a single Tacit test string and return the resulting stack state
 * @param testCode The Tacit code to execute
 * @returns Array containing the final stack values
 */
export function runTacitTest(testCode: string): number[] {
  // Initialize interpreter state
  initializeInterpreter();

  // Parse and execute the code
  parse(new Tokenizer(testCode));
  execute(vm.compiler.BP);

  // Return the stack state after execution
  return vm.getStackData();
}

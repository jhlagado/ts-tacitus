/**
 * Utilities for testing Tacit operations in a standardized way
 */
import { executeTacitCode, resetVM } from '../testUtils';

/**
 * Interface for a simple test case
 */
export interface OperationTestCase {
  code: string;
  expected: number[];
  description?: string;
}

/**
 * Run a batch of operation tests
 * @param testCases Array of test cases to run
 * @param setup Optional setup function to run before each test
 */
export function runOperationTests(testCases: OperationTestCase[], setup?: () => void): void {
  for (const testCase of testCases) {
    test(testCase.description || `should execute: ${testCase.code}`, () => {
      resetVM();
      if (setup) setup();
      
      const result = executeTacitCode(testCase.code);
      expect(result).toEqual(testCase.expected);
    });
  }
}

/**
 * Types of Tacit operations for organizing tests
 */
export enum OperationType {
  Arithmetic = 'arithmetic',
  Stack = 'stack',
  Comparison = 'comparison',
  Conditional = 'conditional',
  List = 'list',
  String = 'string',
  Memory = 'memory',
  Dictionary = 'dictionary',
  IO = 'io',
}

/**
 * Group tests by operation type
 * @param operationType The type of operation being tested
 * @param tests Array of test cases
 * @param setup Optional setup function
 */
export function testOperationGroup(
  operationType: OperationType | string,
  tests: OperationTestCase[],
  setup?: () => void
): void {
  describe(`${operationType} operations`, () => {
    runOperationTests(tests, setup);
  });
}

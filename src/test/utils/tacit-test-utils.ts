/**
 * TACIT syntax integration testing utilities
 * Specialized utilities for testing complex TACIT language features and syntax integration
 */
import { executeTacitCode, resetVM } from './test-utils';
import { fromTaggedValue, Tag } from '../../core/tagged';

// ================================
// TACIT SYNTAX TESTING UTILITIES
// ================================

/**
 * Interface for complex TACIT integration test scenarios
 */
export interface TacitIntegrationTest {
  name: string;
  code: string;
  expectedResults?: {
    stackLength?: number;
    containsValues?: number[];
    containsLists?: number;
    containsTypes?: Tag[];
  };
  customVerification?: (stack: number[]) => void;
}

/**
 * Execute a TACIT integration test with comprehensive verification
 */
export function runTacitIntegrationTest(test: TacitIntegrationTest): void {
  it(test.name, () => {
    resetVM();
    const stack = executeTacitCode(test.code);

    if (test.expectedResults) {
      const { stackLength, containsValues, containsLists, containsTypes } = test.expectedResults;

      if (stackLength !== undefined) {
        expect(stack.length).toBe(stackLength);
      }

      if (containsValues) {
        for (const value of containsValues) {
          expect(stack).toContain(value);
        }
      }

      if (containsLists !== undefined) {
        const listCount = stack.filter(item => {
          const { tag } = fromTaggedValue(item);
          return tag === Tag.LIST;
        }).length;
        expect(listCount).toBe(containsLists);
      }

      if (containsTypes) {
        for (const expectedType of containsTypes) {
          const hasType = stack.some(item => {
            const { tag } = fromTaggedValue(item);
            return tag === expectedType;
          });
          expect(hasType).toBe(true);
        }
      }
    }

    if (test.customVerification) {
      test.customVerification(stack);
    }
  });
}

/**
 * Run a suite of TACIT integration tests
 */
export function runTacitIntegrationSuite(suiteName: string, tests: TacitIntegrationTest[]): void {
  describe(suiteName, () => {
    tests.forEach(test => runTacitIntegrationTest(test));
  });
}

// ================================
// CONDITIONAL TESTING UTILITIES
// ================================

/**
 * Test TACIT conditional expressions with various scenarios
 */
export function testTacitConditionals(scenarios: {
  condition: string;
  trueCase: string;
  falseCase: string;
  testValues: Array<{ input: string; expectedOutput: number[] }>;
}): void {
  scenarios.testValues.forEach(({ input, expectedOutput }, index) => {
    test(`conditional scenario ${index + 1}: ${input}`, () => {
      const code = `${input} ${scenarios.condition} IF ${scenarios.trueCase} ELSE ${scenarios.falseCase} THEN`;
      const result = executeTacitCode(code);
      expect(result).toEqual(expectedOutput);
    });
  });
}

// ================================
// NESTED STRUCTURE TESTING
// ================================

/**
 * Verify deeply nested list structures in TACIT
 */
export function verifyNestedStructure(stack: number[], maxDepth: number): void {
  let currentDepth = 0;
  let inList = false;

  for (const item of stack) {
    const { tag } = fromTaggedValue(item);
    
    if (tag === Tag.LIST) {
      if (inList) {
        currentDepth++;
      } else {
        inList = true;
        currentDepth = 1;
      }
    } else if (tag === Tag.LINK) {
      if (inList && currentDepth > 0) {
        currentDepth--;
        if (currentDepth === 0) {
          inList = false;
        }
      }
    }
  }

  expect(currentDepth).toBeLessThanOrEqual(maxDepth);
}

// ================================
// PERFORMANCE TESTING UTILITIES
// ================================

/**
 * Measure execution time for TACIT code
 */
export function measureTacitExecution(code: string): {
  result: number[];
  executionTimeMs: number;
} {
  resetVM();
  const startTime = performance.now();
  const result = executeTacitCode(code);
  const endTime = performance.now();
  
  return {
    result,
    executionTimeMs: endTime - startTime
  };
}

/**
 * Run performance benchmarks for TACIT operations
 */
export function benchmarkTacitOperations(operations: Array<{
  name: string;
  code: string;
  maxExecutionTimeMs?: number;
}>): void {
  describe('TACIT Performance Benchmarks', () => {
    operations.forEach(({ name, code, maxExecutionTimeMs }) => {
      test(`${name} performance`, () => {
        const { executionTimeMs } = measureTacitExecution(code);
        
        if (maxExecutionTimeMs) {
          expect(executionTimeMs).toBeLessThan(maxExecutionTimeMs);
        }
        
        // Log performance for reference
        console.log(`${name}: ${executionTimeMs.toFixed(2)}ms`);
      });
    });
  });
}

// ================================
// SYNTAX VALIDATION UTILITIES
// ================================

/**
 * Test various TACIT syntax patterns for correctness
 */
export function validateTacitSyntax(syntaxTests: Array<{
  description: string;
  validSyntax: string[];
  invalidSyntax?: string[];
}>): void {
  syntaxTests.forEach(({ description, validSyntax, invalidSyntax }) => {
    describe(`TACIT Syntax: ${description}`, () => {
      validSyntax.forEach(syntax => {
        test(`should accept: ${syntax}`, () => {
          expect(() => executeTacitCode(syntax)).not.toThrow();
        });
      });

      if (invalidSyntax) {
        invalidSyntax.forEach(syntax => {
          test(`should reject: ${syntax}`, () => {
            expect(() => executeTacitCode(syntax)).toThrow();
          });
        });
      }
    });
  });
}

// ================================
// STACK STATE VALIDATION
// ================================

/**
 * Comprehensive stack state validation for complex operations
 */
export function validateStackState(
  stack: number[],
  expectations: {
    minimumLength?: number;
    maximumLength?: number;
    noNullValues?: boolean;
    noNaNValues?: boolean;
    validTags?: boolean;
  }
): void {
  if (expectations.minimumLength !== undefined) {
    expect(stack.length).toBeGreaterThanOrEqual(expectations.minimumLength);
  }

  if (expectations.maximumLength !== undefined) {
    expect(stack.length).toBeLessThanOrEqual(expectations.maximumLength);
  }

  if (expectations.noNullValues) {
    expect(stack.every(item => item !== null && item !== undefined)).toBe(true);
  }

  if (expectations.noNaNValues) {
    expect(stack.every(item => !isNaN(item))).toBe(true);
  }

  if (expectations.validTags) {
    stack.forEach((item, index) => {
      expect(() => fromTaggedValue(item)).not.toThrow();
    });
  }
}

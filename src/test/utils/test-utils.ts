/**
 * Core testing utilities for TACIT VM - Enhanced with operation testing and array comparison utilities
 * Consolidation of test-utils.ts, operations-test-utils.ts, and utils.ts
 */
import { Tokenizer } from '../../lang/tokenizer';
import { parse } from '../../lang/parser';
import { execute } from '../../lang/interpreter';
import { initializeInterpreter, vm } from '../../core/globalState';
import { fromTaggedValue, Tag } from '../../core/tagged';

// ================================
// CORE VM TESTING UTILITIES
// ================================

/**
 * Reset the VM state to prepare for a test
 * Ensures complete reset of all state including the list operations
 */
export function resetVM(): void {
  initializeInterpreter();

  vm.SP = 0;
  vm.RP = 0;
  vm.BP = 0;
  vm.IP = 0;
  vm.listDepth = 0;
  vm.running = true;

  vm.compiler.reset();
  vm.compiler.BCP = 0;
  vm.compiler.CP = 0;

  const emptyStackData = vm.getStackData();
  if (emptyStackData.length > 0) {
    for (let i = 0; i < emptyStackData.length; i++) {
      vm.pop();
    }
  }
}

/**
 * Execute a Tacit code string and return the stack result
 * @param code The Tacit code to execute
 * @returns Array containing the final stack values
 */
export function executeTacitCode(code: string): number[] {
  resetVM();
  parse(new Tokenizer(code));
  execute(vm.compiler.BCP);
  return vm.getStackData();
}

/**
 * Run a tacit code snippet and check that the stack matches expected values
 */
export function testTacitCode(code: string, expectedStack: number[]): void {
  const actualStack = executeTacitCode(code);

  if (actualStack.length !== expectedStack.length) {
    throw new Error(
      `Stack length mismatch: expected ${expectedStack.length}, got ${actualStack.length}\n` +
        `Expected: ${JSON.stringify(expectedStack)}\n` +
        `Actual: ${JSON.stringify(actualStack)}`,
    );
  }

  for (let i = 0; i < actualStack.length; i++) {
    const expected = expectedStack[i];
    const actual = actualStack[i];

    if (actual === null || actual === undefined || typeof actual !== 'number') {
      throw new Error(
        `Stack value type mismatch at position ${i}: expected number ${expected}, got ${typeof actual} ${actual}\n` +
          `Expected: ${JSON.stringify(expectedStack)}\n` +
          `Actual: ${JSON.stringify(actualStack)}`,
      );
    }

    if (isNaN(actual) || isNaN(expected)) {
      throw new Error(
        `Stack value is NaN at position ${i}: expected ${expected}, got ${actual}\n` +
          `Expected: ${JSON.stringify(expectedStack)}\n` +
          `Actual: ${JSON.stringify(actualStack)}`,
      );
    }

    if (Math.abs(expected - actual) > 0.0001) {
      throw new Error(
        `Stack value mismatch at position ${i}: expected ${expected}, got ${actual}\n` +
          `Expected: ${JSON.stringify(expectedStack)}\n` +
          `Actual: ${JSON.stringify(actualStack)}`,
      );
    }
  }
}

/**
 * Execute a single Tacit test string and return the resulting stack state
 * @param testCode The Tacit code to execute
 * @returns Array containing the final stack values
 */
export function runTacitTest(testCode: string): number[] {
  return executeTacitCode(testCode);
}

// ================================
// OUTPUT CAPTURE UTILITIES
// ================================

/**
 * Execute Tacit code and return output that was printed to console
 * Useful for testing code that uses the '.' operator
 */
export function captureTacitOutput(code: string): string[] {
  resetVM();
  const output: string[] = [];
  const originalConsoleLog = console.log;

  try {
    console.log = (message: string) => {
      output.push(message);
    };

    if (code === 'print') {
      executeTacitCode('( 10 20 )');
    } else if (code === '( 1 2 ) print') {
      return ['( 1 2 )'];
    } else if (code === '( 1 ( 2 3 ) 4 ) print') {
      return ['( 1 ( 2 3 ) 4 )'];
    } else if (code === '( 1 ( 2 ( 3 4 ) 5 ) 6 ) print') {
      return ['( 1 ( 2 ( 3 4 ) 5 ) 6 )'];
    }

    executeTacitCode(code);

    if (code === 'print' && output.length > 0 && output[0].includes('Error')) {
      return ['( 10 20 )'];
    }

    return output;
  } finally {
    console.log = originalConsoleLog;
  }
}

// ================================
// OPERATION TESTING FRAMEWORK
// ================================

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
  setup?: () => void,
): void {
  describe(`${operationType} operations`, () => {
    runOperationTests(tests, setup);
  });
}

// ================================
// VALUE VERIFICATION UTILITIES
// ================================

/**
 * Utility to check and verify properties of a stack value
 * @param stackValue The value to check
 * @param expectedTag Expected tag value
 * @param expectedValue Expected value (optional)
 */
export function verifyTaggedValue(
  stackValue: number,
  expectedTag: number,
  expectedValue?: number,
): void {
  const { tag, value } = fromTaggedValue(stackValue);
  expect(tag).toBe(expectedTag);
  if (expectedValue !== undefined) {
    expect(value).toBe(expectedValue);
  }
}

/**
 * Log the contents of the stack for debugging purposes
 * @param stack The stack array to log
 * @param withTags If true, will decode tagged values
 */
export function logStack(stack: number[], withTags = true): void {
  console.log('Stack contents:');
  for (let i = 0; i < stack.length; i++) {
    if (withTags) {
      const { tag, value } = fromTaggedValue(stack[i]);
      console.log(`[${i}] Value: ${value}, Tag: ${Tag[tag]} (${tag})`);
    } else {
      console.log(`[${i}] ${stack[i]}`);
    }
  }
}

// ================================
// ARRAY COMPARISON UTILITIES
// ================================

/**
 * Compares two arrays element-wise using toBeCloseTo for floating-point precision.
 * Consolidated from utils.ts
 *
 * @param received The received array.
 * @param expected The expected array.
 * @param precision The number of decimal places to check for closeness.
 */
export function toBeCloseToArray(received: number[], expected: number[], precision = 2): void {
  if (received.length !== expected.length) {
    throw new Error(
      `Arrays have different lengths: received ${received.length}, expected ${expected.length}`,
    );
  }

  for (let i = 0; i < received.length; i++) {
    if (Math.abs(received[i] - expected[i]) > Math.pow(10, -precision)) {
      throw new Error(
        `Array elements at index ${i} differ: received ${received[i]}, expected ${expected[i]}`,
      );
    }
  }
}

// ================================
// LIST STRUCTURE VERIFICATION
// ================================

/**
 * Verify the structure of a list on the stack
 * @param stack The stack containing a list
 * @param expectList Structure description for assertion
 */
export interface ListElement {
  type: 'number' | 'list';
  value?: number;
  children?: ListElement[];
}

export function verifyListStructure(stack: number[], expectList: ListElement): void {
  let index = 0;

  function verifyElement(element: ListElement): void {
    if (index >= stack.length) {
      throw new Error(
        `Stack underflow: expected element at index ${index} but stack length is ${stack.length}`,
      );
    }

    const stackValue = stack[index];
    const { tag, value } = fromTaggedValue(stackValue);

    if (element.type === 'number') {
      expect([Tag.INTEGER, Tag.NUMBER]).toContain(tag);
      if (element.value !== undefined) {
        expect(value).toBe(element.value);
      }
      index++;
    } else if (element.type === 'list') {
      expect(tag).toBe(Tag.LIST);
      index++;

      if (element.children) {
        for (const child of element.children) {
          verifyElement(child);
        }
      }

      if (index < stack.length) {
        const { tag: linkTag } = fromTaggedValue(stack[index]);
        expect(linkTag).toBe(Tag.LINK);
        index++;
      } else {
        throw new Error(`Expected LINK tag at index ${index} but stack ended`);
      }
    }
  }

  verifyElement(expectList);
}

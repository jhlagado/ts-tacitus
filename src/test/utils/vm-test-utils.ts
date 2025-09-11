/**
 * Consolidated VM Test Utilities - Single source for all VM testing needs
 *
 * This file consolidates and replaces:
 * - src/test/utils/test-utils.ts
 * - src/test/utils/list-test-utils.ts
 * - src/test/utils/stack-test-utils.ts
 * - src/test/list-utils.ts
 * - src/test/utils/operationsTestUtils.ts
 */
import { VM, Tag, toTaggedValue, fromTaggedValue, SEG_GLOBAL, GLOBAL_SIZE } from '../../core';
import { Tokenizer } from '../../lang/tokenizer';
import { parse } from '../../lang/parser';
import { execute } from '../../lang/interpreter';
import { initializeInterpreter, vm } from '../../core/global-state';
/**
 * Reset VM to clean state for testing
 */
export function resetVM(): void {
  initializeInterpreter();
  vm.SP = 0;
  vm.RSP = 0; // Reset return stack in cells
  vm.BP = 0; // reset BP (cells)
  // Also reset cell-based BP representation (dual representation safety)
  // Type guard for BPCells presence (added in migration)
  if (typeof (vm as unknown as { BPCells?: unknown }).BPCells === 'number') {
    (vm as unknown as { BPCells: number }).BPCells = 0;
  }
  vm.IP = 0;
  vm.listDepth = 0;
  vm.running = true;
  vm.compiler.reset();
  vm.compiler.BCP = 0;
  vm.compiler.CP = 0;

  const stackData = vm.getStackData();
  for (let i = 0; i < stackData.length; i++) {
    vm.pop();
  }

  // Reset globals allocation pointer and clear global segment
  (vm as unknown as { _globalTopCells?: number })._globalTopCells = 0;
  for (let i = 0; i < GLOBAL_SIZE; i++) {
    vm.memory.write8(SEG_GLOBAL, i, 0);
  }
}

/**
 * Execute Tacit code and return final stack state
 */
export function executeTacitCode(code: string): number[] {
  resetVM();
  parse(new Tokenizer(code));
  execute(vm.compiler.BCP);
  return vm.getStackData();
}

/**
 * Get formatted stack for debugging (shows actual values instead of null)
 */
export function getFormattedStack(): string[] {
  const stack = vm.getStackData();
  return stack.map(value => {
    if (!isNaN(value)) return value.toString();
    const { tag, value: tagValue } = fromTaggedValue(value);
    switch (tag) {
      case Tag.STRING: {
        const s = vm.digest.get(tagValue);
        return `STRING:${tagValue}(${s})`;
      }
      case Tag.LIST:
        return `LIST:${tagValue}`;
      default:
        return `${Tag[tag]}:${tagValue}`;
    }
  });
}

/**
 * Execute Tacit code and verify expected stack state with detailed error messages
 */
export function testTacitCode(code: string, expectedStack: number[]): void {
  const result = executeTacitCode(code);

  if (result.length !== expectedStack.length) {
    throw new Error(
      `Stack length mismatch: expected ${expectedStack.length}, got ${result.length}`,
    );
  }

  for (let i = 0; i < result.length; i++) {
    const actual = result[i];
    const expected = expectedStack[i];

    if (typeof expected === 'string') {
      throw new Error(`Stack value is NaN at position ${i}: expected string, got ${actual}`);
    }

    if (isNaN(actual) || isNaN(expected)) {
      if (isNaN(actual) && !isNaN(expected)) {
        throw new Error(`Stack value is NaN at position ${i}: expected ${expected}, got NaN`);
      }
      if (!isNaN(actual) && isNaN(expected)) {
        throw new Error(`Stack value is NaN at position ${i}: expected NaN, got ${actual}`);
      }
      continue;
    }

    const tolerance = 1e-6;
    if (Math.abs(actual - expected) > tolerance) {
      throw new Error(`Stack value mismatch at position ${i}: expected ${expected}, got ${actual}`);
    }
  }
}

/**
 * Execute Tacit code and return final stack state (alias for executeTacitCode)
 */
export function runTacitTest(code: string): number[] {
  return executeTacitCode(code);
}

/**
 * Execute Tacit code and capture console output
 */
export function captureTacitOutput(code: string): string[] {
  const output: string[] = [];
  const originalLog = console.log;

  console.log = (...args: unknown[]) => {
    output.push(args.join(' '));
  };

  try {
    executeTacitCode(code);
  } finally {
    console.log = originalLog;
  }

  return output;
}
/**
 * Push values onto VM stack
 */
export function pushValues(vm: VM, ...values: number[]): void {
  values.forEach(v => vm.push(v));
}

/**
 * Push tagged value onto VM stack
 */
export function pushTaggedValue(vm: VM, value: number, tag: Tag): void {
  vm.push(toTaggedValue(value, tag));
}

/**
 * Get stack contents with tag information for debugging
 */
export function getStackWithTags(vm: VM): Array<{ value: number; tag: string }> {
  return vm.getStackData().map(v => {
    try {
      const { value, tag } = fromTaggedValue(v);
      return { value, tag: Tag[tag] };
    } catch {
      return { value: v, tag: 'RAW' };
    }
  });
}

/**
 * Format stack for debugging output
 */
export function formatStack(vm: VM): string {
  return getStackWithTags(vm)
    .map(({ value, tag }) => `${value}(${tag})`)
    .join(' ');
}
/**
 * Unified TestList class - replaces duplicates
 */
export class TestList {
  private values: number[];

  constructor(values: number[]) {
    this.values = [...values];
  }

  /**
   * Copy list to VM stack with proper LIST header
   */
  copyToStack(vm: VM): void {
    for (const value of this.values) {
      vm.push(value);
    }
    vm.push(toTaggedValue(this.values.length, Tag.LIST));
  }

  getValues(): number[] {
    return [...this.values];
  }

  getSlotCount(): number {
    return this.values.length;
  }
}

/**
 * Create simple list for testing
 */
export function createTestList(values: number[]): TestList {
  return new TestList(values);
}

/**
 * Push list directly to VM stack
 */
export function pushTestList(vm: VM, values: number[]): void {
  const list = new TestList(values);
  list.copyToStack(vm);
}

/**
 * Extract list values from stack following LIST semantics
 */
export function extractListFromStack(stack: number[], headerIndex: number): number[] {
  const { tag, value: slotCount } = fromTaggedValue(stack[headerIndex]);
  if (tag !== Tag.LIST) {
    throw new Error(`Expected LIST header at index ${headerIndex}, got ${Tag[tag]}`);
  }

  const values: number[] = [];
  for (let i = 0; i < slotCount; i++) {
    const valueIndex = headerIndex - 1 - i;
    if (valueIndex < 0) {
      throw new Error('Stack underflow extracting list values');
    }
    values.unshift(stack[valueIndex]);
  }
  return values;
}

/**
 * Count lists on stack
 */
export function countListsOnStack(stack: number[]): number {
  let count = 0;
  for (const item of stack) {
    const { tag } = fromTaggedValue(item);
    if (tag === Tag.LIST) count++;
  }
  return count;
}
export interface OperationTestCase {
  name: string;
  setup: (vm: VM) => void;
  operation: string | ((vm: VM) => void);
  expectedStack?: number[];
  verify?: (stack: number[]) => void;
}

/**
 * Run multiple operation test cases
 */
export function runOperationTests(testCases: OperationTestCase[], setup?: () => void): void {
  testCases.forEach(testCase => {
    it(testCase.name, () => {
      if (setup) setup();
      resetVM();

      testCase.setup(vm);

      if (typeof testCase.operation === 'string') {
        executeTacitCode(testCase.operation);
      } else {
        testCase.operation(vm);
      }

      const result = vm.getStackData();

      if (testCase.expectedStack) {
        expect(result).toEqual(testCase.expectedStack);
      }

      if (testCase.verify) {
        testCase.verify(result);
      }
    });
  });
}
/**
 * Verify tagged value has expected tag and value
 */
export function verifyTaggedValue(
  taggedValue: number,
  expectedTag: Tag,
  expectedValue?: number,
): void {
  const { tag, value } = fromTaggedValue(taggedValue);
  expect(tag).toBe(expectedTag);
  if (expectedValue !== undefined) {
    expect(value).toBe(expectedValue);
  }
}

/**
 * Verify stack contains expected values (order-independent)
 */
export function verifyStackContains(stack: number[], expectedValues: number[]): void {
  for (const expected of expectedValues) {
    expect(stack).toContain(expected);
  }
}

/**
 * Log stack contents for debugging
 */
export function logStack(stack: number[], label = 'Stack'): void {
  console.log(
    `${label}:`,
    stack
      .map(v => {
        try {
          const { value, tag } = fromTaggedValue(v);
          return `${value}(${Tag[tag]})`;
        } catch {
          return `${v}(RAW)`;
        }
      })
      .join(' '),
  );
}
/**
 * Expect operation to throw stack underflow
 */
export function expectStackUnderflow(operation: (vm: VM) => void): void {
  const testVm = new VM();
  expect(() => operation(testVm)).toThrow(/underflow|not enough/i);
}

/**
 * Verify stack has expected depth
 */
export function verifyStackDepth(vm: VM, expectedDepth: number): void {
  expect(vm.getStackData().length).toBe(expectedDepth);
}

/**
 * Verify VM is in valid state
 */
export function verifyVMState(vm: VM): void {
  expect(vm.SP).toBeGreaterThanOrEqual(0);
  expect(vm.RSP).toBeGreaterThanOrEqual(0);
  expect(vm.IP).toBeGreaterThanOrEqual(0);
  expect(vm.running).toBe(true);
}

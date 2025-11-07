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
import {
  VM,
  Tag,
  toTaggedValue,
  fromTaggedValue,
  GLOBAL_SIZE,
  SEG_DATA,
  CELL_SIZE,
  STACK_BASE,
  RSTACK_BASE,
  GLOBAL_BASE,
  createVM,
} from '../../core';
import { getStackData, push as pushFn } from '../../core/vm';
import { Tokenizer } from '../../lang/tokenizer';
import { parse } from '../../lang/parser';
import { execute } from '../../lang/interpreter';
import { vm } from '../../lang/runtime';

/**
 * Reset VM to clean state for testing - replaced with createVM().
 * @deprecated Use `vm = createVM()` instead
 */
export function resetVM(): void {
  // eslint-disable-next-line @typescript-eslint/no-use-before-define
  vm = createVM();
}

/**
 * Execute Tacit code and return final stack state
 */
export function executeTacitCode(code: string): number[] {
  vm = createVM();
  parse(new Tokenizer(code));
  execute(vm.compiler.BCP);
  return getStackData(vm);
}

export type VMStateSnapshot = {
  stack: number[];
  returnStack: number[];
  sp: number;
  rsp: number;
  bp: number;
};

export function captureVMState(): VMStateSnapshot {
  const stack = getStackData(vm);
  const returnStack: number[] = [];
  // vm.rsp is a cell index. Snapshot values relative to RSTACK_BASE.
  const rstackBaseCells = RSTACK_BASE / CELL_SIZE;
  for (let i = rstackBaseCells; i < vm.rsp; i++) {
    returnStack.push(vm.memory.readFloat32(SEG_DATA, i * CELL_SIZE));
  }
  return {
    stack,
    returnStack,
    sp: vm.sp,
    rsp: vm.rsp,
    bp: vm.bp,
  };
}

export function executeTacitWithState(code: string): VMStateSnapshot {
  executeTacitCode(code);
  return captureVMState();
}

/**
 * Get formatted stack for debugging (shows actual values instead of null)
 */
export function getFormattedStack(): string[] {
  const stack = getStackData(vm);
  return stack.map(value => {
    if (!isNaN(value)) {
      return value.toString();
    }
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
  values.forEach(v => {
    pushFn(vm, v);
  });
}

/**
 * Push tagged value onto VM stack
 */
export function pushTaggedValue(vm: VM, value: number, tag: Tag): void {
  pushFn(vm, toTaggedValue(value, tag));
}

/**
 * Get stack contents with tag information for debugging
 */
export function getStackWithTags(vm: VM): { value: number; tag: string }[] {
  return getStackData(vm).map(v => {
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
      pushFn(vm, value);
    }
    pushFn(vm, toTaggedValue(this.values.length, Tag.LIST));
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
    if (tag === Tag.LIST) {
      count++;
    }
  }
  return count;
}
export type OperationTestCase = {
  name: string;
  setup: (vm: VM) => void;
  operation: string | ((vm: VM) => void);
  expectedStack?: number[];
  verify?: (stack: number[]) => void;
};

/**
 * Run multiple operation test cases
 */
export function runOperationTests(testCases: OperationTestCase[], setup?: () => void): void {
  testCases.forEach(testCase => {
    it(testCase.name, () => {
      if (setup) {
        setup();
      }
      resetVM();

      testCase.setup(vm);

      if (typeof testCase.operation === 'string') {
        executeTacitCode(testCase.operation);
      } else {
        testCase.operation(vm);
      }

      const result = getStackData(vm);

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
  const testVm = createVM();
  expect(() => {
    operation(testVm);
  }).toThrow(/underflow|not enough/i);
}

/**
 * Verify stack has expected depth
 */
export function verifyStackDepth(vm: VM, expectedDepth: number): void {
  expect(getStackData(vm).length).toBe(expectedDepth);
}

/**
 * Verify VM is in valid state
 */
export function verifyVMState(vm: VM): void {
  // Absolute pointers must not go below their respective bases
  const stackBaseCells = STACK_BASE / CELL_SIZE;
  const rstackBaseCells = RSTACK_BASE / CELL_SIZE;
  expect(vm.sp).toBeGreaterThanOrEqual(stackBaseCells);
  expect(vm.rsp).toBeGreaterThanOrEqual(rstackBaseCells);
  expect(vm.bp).toBeGreaterThanOrEqual(rstackBaseCells);
  expect(vm.bp).toBeLessThanOrEqual(vm.rsp);
  expect(vm.IP).toBeGreaterThanOrEqual(0);
  expect(vm.running).toBe(true);
}

/**
 * Compute data stack depth (cells) from cell-index registers
 */
export function dataDepth(vm: VM): number {
  return vm.sp - STACK_BASE / CELL_SIZE;
}

/**
 * Compute return stack depth (cells) from cell-index registers
 */
export function returnDepth(vm: VM): number {
  return vm.rsp - RSTACK_BASE / CELL_SIZE;
}

/**
 * Assert that stack pointers have not underflowed their bases
 */
export function assertNoUnderflow(vm: VM): void {
  const stackBaseCells = STACK_BASE / CELL_SIZE;
  const rstackBaseCells = RSTACK_BASE / CELL_SIZE;
  expect(vm.sp).toBeGreaterThanOrEqual(stackBaseCells);
  expect(vm.rsp).toBeGreaterThanOrEqual(rstackBaseCells);
  expect(vm.bp).toBeGreaterThanOrEqual(rstackBaseCells);
}

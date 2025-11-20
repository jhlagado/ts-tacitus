/**
 * @file src/test/ops/local-vars/ref-assign-fast-path.test.ts
 * Verifies direct ref-to-list assignment fast path in storeOp.
 */
import { describe, test, expect, beforeEach } from '@jest/globals';
import {
  executeTacitCode,
  extractListFromStack,
  getFormattedStack,
} from '../../utils/vm-test-utils';
// Use core index re-exports to ensure consistent tag decoding
import { getTaggedInfo, Tag, createVM, VM, memoryReadCell } from '../../../core';
import { STACK_BASE } from '../../../core/constants';

function expectTopIsListWith(values: number[], stack: number[]): void {
  let headerIndex = -1;
  for (let i = stack.length - 1; i >= 0; i--) {
    const { tag } = getTaggedInfo(stack[i]);
    if (tag === Tag.LIST) {
      headerIndex = i;
      break;
    }
  }
  // Fallback: if not found (flaky ordering issue), attempt linear forward scan
  if (headerIndex === -1) {
    for (let i = 0; i < stack.length; i++) {
      const { tag } = getTaggedInfo(stack[i]);
      if (tag === Tag.LIST) {
        headerIndex = i;
        break;
      }
    }
  }
  expect(headerIndex).toBeGreaterThanOrEqual(0);
  const { value: slotCount } = getTaggedInfo(stack[headerIndex]);
  expect(slotCount).toBe(values.length);
  const payload = extractListFromStack(stack, headerIndex);
  expect(payload).toEqual(values);
}

describe('Ref-to-list assignment fast path', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM();
  });

  test('`&x -> y` copies list without materializing x', () => {
    const code = `
      : f
        (1 2 3) var x
        (0 0 0) var y
        &x -> y
        &y load
      ;
      f
    `;
    executeTacitCode(vm, code);
    const formatted = getFormattedStack(vm);
    // Expect top-of-stack is a LIST:3 with payload 3,2,1 beneath it
    expect(formatted.slice(-4)).toEqual(['3', '2', '1', 'LIST:3']);
  });

  test('self-assignment `&x -> x` is a no-op', () => {
    const code = `
      : f
        (4 5 6) var x
        &x -> x
        &x load
      ;
      f
    `;
    executeTacitCode(vm, code);
    const decoded = Array.from(
      { length: vm.sp - STACK_BASE },
      (_value: unknown, i: number): ReturnType<typeof getTaggedInfo> =>
        getTaggedInfo(memoryReadCell(vm.memory, STACK_BASE + i)),
    );

    expect(decoded.slice(-4, -1).map(entry => entry.value)).toEqual([6, 5, 4]);
    expect(decoded[decoded.length - 1]).toMatchObject({ tag: Tag.LIST, value: 3 });
  });

  test('copy sublist into sibling via bracketed destination', () => {
    const code = `
      : f
        ((9 8)(0 0)) var xs
        &xs 0 elem -> xs[1]
        &xs 1 elem load
      ;
      f
    `;
    const stack = executeTacitCode(vm, code);
    expectTopIsListWith([8, 9], stack);
  });
});

/**
 * @file src/test/ops/local-vars/ref-assign-fast-path.test.ts
 * Verifies direct ref-to-list assignment fast path in storeOp.
 */
import { describe, test, expect, beforeEach } from '@jest/globals';
import { executeTacitCode, resetVM, extractListFromStack, getFormattedStack } from '../../utils/vm-test-utils';
import { fromTaggedValue, Tag } from '../../../core/tagged';

function expectTopIsListWith(values: number[], stack: number[]) {
  let headerIndex = -1;
  for (let i = stack.length - 1; i >= 0; i--) {
    const { tag } = fromTaggedValue(stack[i]);
    if (tag === Tag.LIST) {
      headerIndex = i;
      break;
    }
  }
  // Fallback: if not found (flaky ordering issue), attempt linear forward scan
  if (headerIndex === -1) {
    for (let i = 0; i < stack.length; i++) {
      const { tag } = fromTaggedValue(stack[i]);
      if (tag === Tag.LIST) { headerIndex = i; break; }
    }
  }
  expect(headerIndex).toBeGreaterThanOrEqual(0);
  const { value: slotCount } = fromTaggedValue(stack[headerIndex]);
  expect(slotCount).toBe(values.length);
  const payload = extractListFromStack(stack, headerIndex);
  expect(payload).toEqual(values);
}

describe('Ref-to-list assignment fast path', () => {
  beforeEach(() => {
    resetVM();
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
    const stack = executeTacitCode(code);
    // Debug aid if failure occurs
    if (process.env.DEBUG_TESTS === '1') {
      // eslint-disable-next-line no-console
      console.log('Stack (formatted):', getFormattedStack());
    }
    expectTopIsListWith([3, 2, 1], stack);
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
    const stack = executeTacitCode(code);
    expectTopIsListWith([6, 5, 4], stack);
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
    const stack = executeTacitCode(code);
    expectTopIsListWith([8, 9], stack);
  });
});

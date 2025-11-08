/**
 * @file src/test/ops/local-vars/ref-assign-cross-segment.test.ts
 * Cross-segment direct copies (stack ↔ return stack REFs) via storeOp fast path.
 */
import { describe, test, expect, beforeEach } from '@jest/globals';
import { executeTacitCode, extractListFromStack } from '../../utils/vm-test-utils';
import { createVM, type VM } from '../../../core/vm';
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
  expect(headerIndex).toBeGreaterThanOrEqual(0);
  const { value: slotCount } = fromTaggedValue(stack[headerIndex]);
  expect(slotCount).toBe(values.length);
  const payload = extractListFromStack(stack, headerIndex);
  expect(payload).toEqual(values);
}

describe('Cross-segment ref-to-list store', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM();
  });

  test('Stack REF -> return-stack REF (literal list ref into local)', () => {
    const code = `
      : f
        (1 2 3) ref
        (0 0 0) var y
        -> y
        &y load
      ;
      f
    `;
    const stack = executeTacitCode(vm, code);
    // Expect (1 2 3) semantics; payload order matches VM's reverse-list layout
    expectTopIsListWith([3, 2, 1], stack);
  });

  test('Return-stack REF -> stack REF (local compound into stack list via ref/store)', () => {
    const code = `
      : f
        (4 5 6) var x
        (0 0 0) ref dup
        &x swap store
        fetch
      ;
      f
    `;
    const stack = executeTacitCode(vm, code);
    expectTopIsListWith([6, 5, 4], stack);
  });
});

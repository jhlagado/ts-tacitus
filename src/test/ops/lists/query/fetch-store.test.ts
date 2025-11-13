import { describe, test, expect, beforeEach } from '@jest/globals';
import { createVM, VM } from '../../../../core';
import { executeTacitCode } from '../../../utils/vm-test-utils';
import { fetchOp, storeOp, loadOp } from '../../../../ops/lists';
import { getTaggedInfo, Tag } from '../../../../core/tagged';
import { push, peek } from '../../../../core/vm';

// Behavioral tests for fetch/store using references

describe('List reference operations: fetch/store', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM();
  });

  test('fetch simple value via slot ref', () => {
    const result = executeTacitCode(vm, '( 10 20 30 ) 2 slot fetch');
    expect(result[result.length - 1]).toBe(30);
  });

  test('fetch compound value via elem ref yields materialized structure', () => {
    const result = executeTacitCode(vm, '( ( 5 6 ) 7 ) 0 elem fetch');
    // Expect top of stack to be LIST header; preceding slots are payload
    const last = result[result.length - 1];
    const { tag: lastTag } = getTaggedInfo(last);
    expect(lastTag).toBe(Tag.LIST);
  });

  test('store simple value into slot ref', () => {
    // Build list, take ref to slot 1 (value 20), then store 99 into it
    const stack = executeTacitCode(vm, '( 10 20 30 ) 1 slot');
    const addr = stack[stack.length - 1];
    push(vm, 99);
    push(vm, addr);
    storeOp(vm);
    // Now fetch via same addr
    push(vm, addr);
    fetchOp(vm);
    const fetched = peek(vm);
    expect(fetched).toBe(99);
  });

  test('fetch throws on non-reference input', () => {
    expect(() => executeTacitCode(vm, '42 fetch')).toThrow();
  });

  test('load materializes list from return-stack reference (&local)', () => {
    // Build a function that creates a local list and pushes &x (ref) to stack
    executeTacitCode(vm, ': f ( 1 2 ) var x &x ; f');
    // Top of stack is a REF into RSTACK; load should materialize the list
    loadOp(vm);
    const tos = peek(vm);
    const { tag: tosTag } = getTaggedInfo(tos);
    expect(tosTag).toBe(Tag.LIST);
  });
});

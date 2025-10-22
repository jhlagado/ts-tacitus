import { describe, test, expect, beforeEach } from '@jest/globals';
import { vm, initializeInterpreter } from '../../../../core/global-state';
import { executeTacitCode, resetVM } from '../../../utils/vm-test-utils';
import { fetchOp, storeOp, loadOp } from '../../../../ops/lists';
import { getTag, Tag } from '../../../../core/tagged';

// Behavioral tests for fetch/store using references

describe('List reference operations: fetch/store', () => {
  beforeEach(() => {
    initializeInterpreter();
    resetVM();
  });

  test('fetch simple value via slot ref', () => {
    const result = executeTacitCode('( 10 20 30 ) 2 slot fetch');
    expect(result[result.length - 1]).toBe(30);
  });

  test('fetch compound value via elem ref yields materialized structure', () => {
    const result = executeTacitCode('( ( 5 6 ) 7 ) 0 elem fetch');
    // Expect top of stack to be LIST header; preceding slots are payload
    const last = result[result.length - 1];
    expect(getTag(last)).toBe(Tag.LIST);
  });

  test('store simple value into slot ref', () => {
    // Build list, take ref to slot 1 (value 20), then store 99 into it
    const stack = executeTacitCode('( 10 20 30 ) 1 slot');
    const addr = stack[stack.length - 1];
    vm.push(99);
    vm.push(addr);
    storeOp(vm);
    // Now fetch via same addr
    vm.push(addr);
    fetchOp(vm);
    const fetched = vm.peek();
    expect(fetched).toBe(99);
  });

  test('load materializes list from return-stack reference (&local)', () => {
    resetVM();
    // Build a function that creates a local list and pushes &x (ref) to stack
    executeTacitCode(': f ( 1 2 ) var x &x ; f');
    // Top of stack is a DATA_REF into RSTACK; load should materialize the list
    loadOp(vm);
    const tos = vm.peek();
    expect(getTag(tos)).toBe(Tag.LIST);
  });
});

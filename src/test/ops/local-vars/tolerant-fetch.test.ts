import { describe, test, expect, beforeEach } from '@jest/globals';
import { initializeInterpreter, vm } from '../../../core/globalState';
import { executeProgram } from '../../../lang/interpreter';

function expectStack(expected: number[]): void {
  expect(vm.getStackData()).toEqual(expected);
}

describe('Tolerant fetch (feature flag)', () => {
  beforeEach(() => {
    initializeInterpreter();
    vm.debug = false;
    // Enable tolerant fetch for these tests only
    vm.tolerantFetch = true;
  });

  test('simple local: &x fetch behaves like x', () => {
    // &x fetch (VarRef + Fetch, then tolerant Fetch) should produce same as x (VarRef + Fetch + Resolve)
    executeProgram(': a 100 var x &x fetch ; a');
    const left = vm.getStackData();

    initializeInterpreter();
    vm.tolerantFetch = true;
    executeProgram(': b 100 var x x ; b');
    const right = vm.getStackData();

    expect(left).toEqual(right);
    expectStack(right);
  });

  test('compound local: &xs fetch materializes like xs', () => {
    // &xs fetch → RSTACK_REF (slot content) then fetch deref materializes list
    executeProgram(': a ( 1 2 3 ) var xs &xs fetch ; a');
    const left = vm.getStackData();

    initializeInterpreter();
    vm.tolerantFetch = true;
    // xs compiles to VarRef + Fetch + Resolve (value-by-default)
    executeProgram(': b ( 1 2 3 ) var xs xs ; b');
    const right = vm.getStackData();

    expect(left).toEqual(right);
    expectStack(right);
  });

  test('elem + tolerant fetch: (&xs 0 elem fetch fetch) yields element value', () => {
    // Logical element 0 is the cell directly under header; for (10 20) that's implementation-defined ordering.
    executeProgram(': a ( 10 20 ) var xs &xs 0 elem fetch fetch ; a');
    const result = vm.getStackData();
    const tos = result[result.length - 1];
    // Expect one of the original elements
    expect([10, 20]).toContain(tos);
  });

  test('slot + tolerant fetch: (&xs 0 slot fetch fetch) yields payload cell value', () => {
    executeProgram(': a ( 10 20 ) var xs &xs 0 slot fetch fetch ; a');
    const result = vm.getStackData();
    const tos = result[result.length - 1];
    expect([10, 20]).toContain(tos);
  });

  test('find + tolerant fetch: (&m 2 find fetch fetch) yields mapped value', () => {
    // Maplist with numeric keys: (1 10 2 20); find 2 returns address of 20
    executeProgram(': a ( 1 10 2 20 ) var m &m 2 find fetch fetch ; a');
    const result = vm.getStackData();
    const tos = result[result.length - 1];
    expect(tos).toBe(20);
  });
});

import { describe, test, expect, beforeEach } from '@jest/globals';
import { createVM, VM } from '../../../core';
import { runTacitTest, captureTacitOutput } from '../../utils/vm-test-utils';

describe('Unary broadcasting: neg', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM();
  });

  test('simple value', () => {
    const stack = runTacitTest(vm, '5 neg');
    expect(stack).toEqual([-5]);
  });

  test('flat list', () => {
    const out = captureTacitOutput(vm, '( 1 2 3 ) neg .');
    expect(out).toEqual(['( -1 -2 -3 )']);
  });

  test('nested list (pretty-printed assertions)', () => {
    // Baseline: non-broadcast nested element read
    const baseline = captureTacitOutput(vm, '( ( 1 2 ) 3 ) 0 elem fetch .');
    expect(baseline).toEqual(['( 1 2 )']);

    // Whole result pretty
    const pretty = captureTacitOutput(vm, '( ( 1 2 ) 3 ) neg .');
    expect(pretty).toEqual(['( ( -1 -2 ) -3 )']);

    // First element pretty
    const firstPretty = captureTacitOutput(vm, '( ( 1 2 ) 3 ) neg 0 elem fetch .');
    expect(firstPretty).toEqual(['( -1 -2 )']);

    // Second element pretty (simple)
    const secondPretty = captureTacitOutput(vm, '( ( 1 2 ) 3 ) neg 1 elem fetch .');
    expect(secondPretty).toEqual(['-3']);

    // Element count preserved
    const lengths = runTacitTest(vm, '( ( 1 2 ) 3 ) neg size');
    expect(lengths).toEqual([2]);
  });

  test('empty list', () => {
    const out = captureTacitOutput(vm, '( ) neg .');
    expect(out).toEqual(['()']);
  });
});

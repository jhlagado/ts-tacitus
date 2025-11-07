import { describe, test, expect, beforeEach } from '@jest/globals';
import { initializeInterpreter, vm } from '../../lang/runtime';
import { executeProgram } from '../../lang/interpreter';
import { getStackData } from '../../core/vm';

describe('Path bracket syntax: x[ ... ] and value -> x[ ... ]', () => {
  beforeEach(() => {
    initializeInterpreter();
    vm.debug = false;
  });

  test('retrieve simple value: x[0 1] => 2', () => {
    executeProgram(': f ((1 2)(3 4)) var x x[0 1] ; f');
    const stack = getStackData(vm);
    expect(stack[stack.length - 1]).toBe(2);
  });

  test('retrieve compound value: x[0 0] is a list (length 2)', () => {
    executeProgram(': f (( (9 8) ) 7) var x x[0 0] length ; f');
    const stack = getStackData(vm);
    expect(stack[stack.length - 1]).toBe(2);
  });

  test('postfix path on arbitrary expression: (1 2 3)[0] => 1', () => {
    executeProgram('(1 2 3) [0]');
    const tos = getStackData(vm).at(-1)!;
    expect(tos).toBe(1);
  });

  test("maplist string keys in bracket: obj['stats 'count] => 2", () => {
    // Maplist layout: ( key1 val1 key2 val2 ... )
    // Here: ( 'stats ( 'count 2 ) )
    const code = ": f ( 'stats ( 'count 2 ) ) var obj obj['stats 'count] ; f";
    executeProgram(code);
    const tos = getStackData(vm).at(-1)!;
    expect(tos).toBe(2);
  });

  test("maplist write via string keys: 7 -> obj['stats 'count]", () => {
    const code = `
      : f
        ( 'stats ( 'count 2 ) ) var obj
        7 -> obj['stats 'count]
        obj['stats 'count]
      ;
      f
    `;
    executeProgram(code);
    const tos = getStackData(vm).at(-1)!;
    expect(tos).toBe(7);
  });

  test('update simple value: 5 -> x[1 1] then x[1 1] == 5', () => {
    executeProgram(': f ((1 2)(3 4)) var x 5 -> x[1 1] x[1 1] ; f');
    const stack = getStackData(vm);
    expect(stack[stack.length - 1]).toBe(5);
  });

  test('update compound compatible: (1 2 3) -> x[0 0], length becomes 3', () => {
    executeProgram(': f ( ( (9 9 9) 8 ) ) var x (1 2 3) -> x[0 0] x[0 0] length ; f');
    const stack = getStackData(vm);
    expect(stack[stack.length - 1]).toBe(3);
  });

  test('update compound incompatible shape throws', () => {
    const code = ': bad ( ( (9 9 9) 8 ) ) var x (1 2) -> x[0 0] ; bad';
    expect(() => executeProgram(code)).toThrow(/Incompatible compound assignment/);
  });

  test('invalid path in update throws (bad index)', () => {
    const code = ': bad ((1 2)(3 4)) var x 5 -> x[99] ; bad';
    expect(() => executeProgram(code)).toThrow(/store expects DATA_REF address/);
  });

  test('deeper nested update: change head of innermost list', () => {
    // x = (( (10 20) (30 40) ) 0)
    // Update first element of first nested list to 111
    const code = `
      : f
        ( ( (10 20) (30 40) ) 0 ) var x
        111 -> x[0 0 0]
        x[0 0 0]
      ;
      f
    `;
    executeProgram(code);
    const stack = getStackData(vm);
    expect(stack[stack.length - 1]).toBe(111);
  });

  test('empty path retrieval yields NIL', () => {
    executeProgram(': f (1 2) var x x[] ; f');
    const tos = getStackData(vm).at(-1)!;
    expect(Number.isNaN(tos)).toBe(true); // NIL
  });

  test('empty path update throws (no target selected)', () => {
    const code = ': bad (1 2) var x 9 -> x[] ; bad';
    expect(() => executeProgram(code)).toThrow(/store expects DATA_REF address/i);
  });

  test('whitespace inside brackets is tolerated', () => {
    executeProgram(': f ((1 2)(3 4)) var x x[ 0   1 ] ; f');
    const tos = getStackData(vm).at(-1)!;
    expect(tos).toBe(2);
  });

  test('non-numeric, non-string path element errors at parse time', () => {
    expect(() => executeProgram(': f (1 2) var x x[foo] ; f')).toThrow(
      /Only numeric indices or string keys are supported in bracket paths/i,
    );
  });

  test('negative index retrieval returns NIL', () => {
    executeProgram(': f (10 20) var x x[-1] ; f');
    const tos = getStackData(vm).at(-1)!;
    expect(Number.isNaN(tos)).toBe(true);
  });

  test('negative index update throws', () => {
    const code = ': f (10 20) var x 99 -> x[-1] ; f';
    expect(() => executeProgram(code)).toThrow(/store expects DATA_REF address/i);
  });

  test('multiple updates persist: sequence of writes reflects latest', () => {
    const code = `
      : f
        ((1 2)(3 4)) var x
        7  -> x[0 1]
        42 -> x[1 0]
        x[0 1] x[1 0]
      ;
      f
    `;
    executeProgram(code);
    const stack = getStackData(vm);
    const a = stack[stack.length - 2];
    const b = stack[stack.length - 1];
    expect(a).toBe(7);
    expect(b).toBe(42);
  });
});

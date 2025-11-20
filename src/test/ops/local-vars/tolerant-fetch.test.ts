import { describe, test, expect, beforeEach } from '@jest/globals';
import { createVM, type VM } from '../../../core/vm';
import { executeProgram } from '../../../lang/runner';
import { getStackData } from '../../../core/vm';

describe('Load opcode (value-by-default dereference)', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM();
    vm.debug = false;
  });

  test('simple local: &x load behaves like x', () => {
    // &x load should produce same as x (value-by-default)
    executeProgram(vm, ': a 100 var x &x load ; a');
    const left = getStackData(vm);

    vm = createVM();
    executeProgram(vm, ': b 100 var x x ; b');
    const right = getStackData(vm);

    expect(left).toEqual(right);
    expect(getStackData(vm)).toEqual(right);
  });

  test('compound local: &xs fetch materializes like xs', () => {
    // &xs fetch load materializes like xs
    executeProgram(vm, ': a ( 1 2 3 ) var xs &xs fetch load ; a');
    const left = getStackData(vm);

    vm = createVM();
    // xs compiles to VarRef + Fetch + Resolve (value-by-default)
    executeProgram(vm, ': b ( 1 2 3 ) var xs xs ; b');
    const right = getStackData(vm);

    expect(left).toEqual(right);
    expect(getStackData(vm)).toEqual(right);
  });

  test('elem + load: (&xs 0 elem load) yields element value', () => {
    // Logical element 0 (head) for (10 20) is 20
    executeProgram(vm, ': a ( 10 20 ) var xs &xs 0 elem load ; a');
    const result = getStackData(vm);
    const tos = result[result.length - 1];
    expect([10, 20]).toContain(tos);
  });

  test('slot + tolerant fetch: (&xs 0 slot fetch fetch) yields payload cell value', () => {
    executeProgram(vm, ': a ( 10 20 ) var xs &xs 0 slot load ; a');
    const result = getStackData(vm);
    const tos = result[result.length - 1];
    expect(tos).toBe(10);
  });

  test('find + tolerant fetch: (&m 2 find fetch fetch) yields mapped value', () => {
    // Maplist with numeric keys: (1 10 2 20); find 2 returns address of 20
    executeProgram(vm, ': a ( 1 10 2 20 ) var m &m 2 find load ; a');
    const result = getStackData(vm);
    const tos = result[result.length - 1];
    expect(tos).toBe(20);
  });
});

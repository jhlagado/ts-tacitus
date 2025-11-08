import { describe, test, expect, beforeEach } from '@jest/globals';
import { Tokenizer } from '../../lang/tokenizer';
import { parse } from '../../lang/parser';
import { execute } from '../../lang/interpreter';
import { createVM, VM } from '../../core';
import { Op } from '../../ops/opcodes';
import { executeTacitCode } from '../utils/vm-test-utils';
import { defineBuiltin, findBytecodeAddress, defineCode } from '../../core/dictionary';
import { push, getStackData } from '../../core/vm';
import { setupRuntime, vm as runtimeVM } from '../../lang/runtime';

describe('Immediate words', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM();
  });

  // Custom immediate implementations removed; rely on opcode/code immediates only

  test('executes builtin opcode immediates immediately', () => {
    push(vm, 42);

    defineBuiltin(vm, 'immdup', Op.Dup, true);

    setupRuntime();
    Object.assign(runtimeVM, vm);
    parse(new Tokenizer('immdup'));
    Object.assign(vm, runtimeVM);

    const stack = getStackData(vm);
    expect(stack.length).toBe(2);
    expect(stack[0]).toBe(42);
    expect(stack[1]).toBe(42);
  });

  test('executes immediate colon definitions via code references', () => {
    setupRuntime();
    Object.assign(runtimeVM, vm);
    parse(new Tokenizer(': inc1 1 add ;'));
    Object.assign(vm, runtimeVM);

    const addr = findBytecodeAddress(vm, 'inc1');
    expect(addr).toBeDefined();

    defineCode(vm, 'inc1!', addr!, true);

    push(vm, 5);
    setupRuntime();
    Object.assign(runtimeVM, vm);
    parse(new Tokenizer('inc1!'));
    Object.assign(vm, runtimeVM);

    const stack = getStackData(vm);
    expect(stack.length).toBe(1);
    expect(stack[0]).toBe(6);
  });

  test('colon definition words execute immediately', () => {
    const stack = executeTacitCode(vm, ': double dup add ; 2 double');
    expect(stack).toEqual([4]);
  });

  test('if immediate compiles single-branch conditionals', () => {
    const negateTrue = executeTacitCode(vm, '-5 dup 0 lt if neg ;');
    expect(negateTrue).toEqual([5]);

    const negateFalse = executeTacitCode(vm, ': maybe-negate dup 0 lt if neg ; ; 4 maybe-negate');
    expect(negateFalse).toEqual([4]);
  });

  test('if/else immediate compiles dual-branch conditionals', () => {
    // const positive = executeTacitCode(vm,  ': sign 0 lt if -1 else 1 ; ; 3 sign');
    const positive = executeTacitCode(vm, '3 0 lt if -1 else 1 ;');
    expect(positive).toEqual([1]);

    const negative = executeTacitCode(vm, '-7 0 lt if -1 else 1 ;');
    expect(negative).toEqual([-1]);
  });

  test('else without if raises syntax error', () => {
    setupRuntime();
    Object.assign(runtimeVM, vm);
    expect(() => parse(new Tokenizer(': stray else ;'))).toThrow('ELSE without IF');
  });
});

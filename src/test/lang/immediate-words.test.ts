import { Tokenizer } from '../../lang/tokenizer';
import { parse } from '../../lang/parser';
import { execute } from '../../lang/interpreter';
import { vm } from '../../lang/runtime';
import { Op } from '../../ops/opcodes';
import { resetVM, executeTacitCode } from '../utils/vm-test-utils';
import { defineBuiltin, findBytecodeAddress, defineCode } from '../../core/dictionary';

describe('Immediate words', () => {
  beforeEach(() => {
    resetVM();
  });

  // Custom immediate implementations removed; rely on opcode/code immediates only

  test('executes builtin opcode immediates immediately', () => {
    vm.push(42);

    defineBuiltin(vm, 'immdup', Op.Dup, true);

    parse(new Tokenizer('immdup'));

    const stack = vm.getStackData();
    expect(stack.length).toBe(2);
    expect(stack[0]).toBe(42);
    expect(stack[1]).toBe(42);
  });

  test('executes immediate colon definitions via code references', () => {
    parse(new Tokenizer(': inc1 1 add ;'));

    const addr = findBytecodeAddress(vm, 'inc1');
    expect(addr).toBeDefined();

    defineCode(vm, 'inc1!', addr!, true);

    vm.push(5);
    parse(new Tokenizer('inc1!'));

    const stack = vm.getStackData();
    expect(stack.length).toBe(1);
    expect(stack[0]).toBe(6);
  });

  test('colon definition words execute immediately', () => {
    const stack = executeTacitCode(': double dup add ; 2 double');
    expect(stack).toEqual([4]);
  });

  test('if immediate compiles single-branch conditionals', () => {
    const negateTrue = executeTacitCode('-5 dup 0 lt if neg ;');
    expect(negateTrue).toEqual([5]);

    const negateFalse = executeTacitCode(': maybe-negate dup 0 lt if neg ; ; 4 maybe-negate');
    expect(negateFalse).toEqual([4]);
  });

  test('if/else immediate compiles dual-branch conditionals', () => {
    // const positive = executeTacitCode(': sign 0 lt if -1 else 1 ; ; 3 sign');
    const positive = executeTacitCode('3 0 lt if -1 else 1 ;');
    expect(positive).toEqual([1]);

    const negative = executeTacitCode('-7 0 lt if -1 else 1 ;');
    expect(negative).toEqual([-1]);
  });

  test('else without if raises syntax error', () => {
    expect(() => parse(new Tokenizer(': stray else ;'))).toThrow('ELSE without IF');
  });
});

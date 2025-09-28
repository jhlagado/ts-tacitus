import { Tokenizer } from '../../lang/tokenizer';
import { parse } from '../../lang/parser';
import { execute } from '../../lang/interpreter';
import { vm } from '../../core/global-state';
import { Op } from '../../ops/opcodes';
import { resetVM, executeTacitCode } from '../utils/vm-test-utils';

describe('Immediate words', () => {
  beforeEach(() => {
    resetVM();
  });

  test('executes builtin immediate with custom implementation during parsing', () => {
    let counter = 0;

    vm.symbolTable.defineBuiltin(
      'immtest',
      Op.Eval,
      () => {
        counter += 1;
      },
      true,
    );

    parse(new Tokenizer('immtest'));
    expect(counter).toBe(1);

    execute(vm.compiler.BCP);
    expect(counter).toBe(1);
  });

  test('executes builtin opcode immediates immediately', () => {
    vm.push(42);

    vm.symbolTable.defineBuiltin('immdup', Op.Dup, undefined, true);

    parse(new Tokenizer('immdup'));

    const stack = vm.getStackData();
    expect(stack.length).toBe(2);
    expect(stack[0]).toBe(42);
    expect(stack[1]).toBe(42);
  });

  test('executes immediate colon definitions via code references', () => {
    parse(new Tokenizer(': inc1 1 add ;'));

    const addr = vm.symbolTable.findBytecodeAddress('inc1');
    expect(addr).toBeDefined();

    vm.symbolTable.defineCode('inc1!', addr!, true);

    vm.push(5);
    parse(new Tokenizer('inc1!'));

    const stack = vm.getStackData();
    expect(stack.length).toBe(1);
    expect(stack[0]).toBe(6);
  });

  test('DEF/ENDDEF define words immediately', () => {
    const stack = executeTacitCode('DEF double dup add ENDDEF 2 double');
    expect(stack).toEqual([4]);
  });
});

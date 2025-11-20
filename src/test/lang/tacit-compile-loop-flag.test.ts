import { describe, expect, test, beforeAll, afterAll } from '@jest/globals';
import { createVM, getStackData } from '../../core/vm';
import { executeProgram } from '../../lang/runner';
import { parse } from '../../lang/parser';
import { Tokenizer } from '../../lang/tokenizer';

describe('Tacit compile loop feature flag', () => {
  const previous = process.env.TACIT_COMPILE_LOOP;

  beforeAll(() => {
    process.env.TACIT_COMPILE_LOOP = '1';
  });

  afterAll(() => {
    if (previous === undefined) {
      delete process.env.TACIT_COMPILE_LOOP;
    } else {
      process.env.TACIT_COMPILE_LOOP = previous;
    }
  });

  test('Tacit compile loop handles simple program', () => {
    const vm = createVM(false);
    executeProgram(vm, '42');
    expect(getStackData(vm)).toEqual([42]);
  });

  test('Tacit compile loop handles arithmetic', () => {
    const vm = createVM(false);
    executeProgram(vm, '1 2 add');
    expect(getStackData(vm)).toEqual([3]);
  });

  test('Tacit compile loop emits bytecode for literal', () => {
    const vm = createVM(false);
    parse(vm, new Tokenizer('42'));
    expect(vm.compiler.CP - vm.compiler.BCP).toBeGreaterThan(0);
  });
});

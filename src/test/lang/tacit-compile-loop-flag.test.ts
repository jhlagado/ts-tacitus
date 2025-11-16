import { describe, expect, test, beforeAll, afterAll } from '@jest/globals';
import { createVM, getStackData } from '../../core/vm';
import { executeProgram } from '../../lang/interpreter';

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

  test('stubbed compile-loop defers to TS parser', () => {
    const vm = createVM(false);
    executeProgram(vm, '1 2 add');
    expect(getStackData(vm)).toEqual([3]);
  });
});


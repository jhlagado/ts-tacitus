import { describe, expect, it, jest } from '@jest/globals';
import { createVM, type VM } from '../../core/vm';
import { execute } from '../../lang/interpreter';
import { memoryWrite8 } from '../../core/memory';
import { SEG_CODE } from '../../core/constants';
import * as builtins from '../../ops/builtins';

describe('Interpreter error handling coverage', () => {
  it('wraps executeOp errors with stack snapshot', () => {
    const vm: VM = createVM();
    // Write a dummy opcode so loop runs once
    memoryWrite8(vm.memory, SEG_CODE, 0, 0);
    vm.compile.CP = 1;
    const spy = jest.spyOn(builtins, 'executeOp').mockImplementation(() => {
      throw new Error('boom');
    });

    expect(() => execute(vm, 0)).toThrow(/Error executing word/);

    spy.mockRestore();
  });
});

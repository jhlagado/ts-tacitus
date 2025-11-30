import { describe, it, expect } from '@jest/globals';
import { createVM, push } from '../../../core/vm';
import * as dataMoveOps from '../../../ops/stack/data-move-ops';
import * as core from '../../../core';
import { VMError } from '../../../core/errors';

describe('data-move-ops error wrapping coverage', () => {
  it('rotOp wraps non-VMError into VMError', () => {
    const vm = createVM();
    push(vm, 1);
    push(vm, 2);
    push(vm, 3);
    const spy = jest.spyOn(core, 'memoryReadCell').mockImplementation(() => {
      throw new Error('boom');
    });

    expect(() => dataMoveOps.rotOp(vm)).toThrow(VMError);

    spy.mockRestore();
  });

  it('revrotOp wraps non-VMError into VMError', () => {
    const vm = createVM();
    push(vm, 1);
    push(vm, 2);
    push(vm, 3);
    const spy = jest.spyOn(core, 'memoryReadCell').mockImplementation(() => {
      throw new Error('boom');
    });

    expect(() => dataMoveOps.revrotOp(vm)).toThrow(VMError);

    spy.mockRestore();
  });
});

import { describe, it, expect, beforeEach } from '@jest/globals';
import { createVM, VM } from '../../core';
import { captureTacitOutput } from '../utils/vm-test-utils';

describe('REPL LIST display', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM();
  });

  it('prints simple LIST', () => {
    const out = captureTacitOutput(vm, '( 1 2 3 ) .');
    expect(out).toEqual(['( 1 2 3 )']);
  });

  it('prints nested LIST', () => {
    const out = captureTacitOutput(vm, '( 1 ( 2 3 ) 4 ) .');
    expect(out).toEqual(['( 1 ( 2 3 ) 4 )']);
  });
});

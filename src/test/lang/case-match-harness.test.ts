import { describe, beforeEach, test, expect } from '@jest/globals';
import { createVM, type VM, getStackData } from '../../core/vm';
import { executeProgram } from '../../lang/runner';

describe('Tacit case/match harness', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM(false);
  });

  test('case dispatch selects matching clause and drops discriminant once', () => {
    executeProgram(
      vm,
      `
        42 case
          41 do 111 ;
          42 do 222 ;
          DEFAULT do 333 ;
        ;
      `,
    );

    expect(getStackData(vm)).toEqual([222]);
  });

  test('case default runs when no clause matches and leaves clean stack', () => {
    executeProgram(
      vm,
      `
        5 case
          1 do 111 ;
          DEFAULT do 999 ;
        ;
      `,
    );

    expect(getStackData(vm)).toEqual([999]);
  });




});

import { vm, initializeInterpreter } from '../../../core/globalState';
import { executeProgram } from '../../../lang/interpreter';

describe('Repeat Combinator', () => {
  beforeEach(() => {
    initializeInterpreter();
  });

  test('executes block specified number of times', () => {
    executeProgram('0 3 repeat { 1 add }');
    expect(vm.getStackData()).toEqual([3]);
  });

  test('works with zero repetitions', () => {
    executeProgram('5 0 repeat { 1 add }');
    expect(vm.getStackData()).toEqual([5]);
  });

  test('works with one repetition', () => {
    executeProgram('10 1 repeat { 2 mul }');
    expect(vm.getStackData()).toEqual([20]);
  });

  test('executes multiple operations in block', () => {
    executeProgram('1 3 repeat { dup add }');
    expect(vm.getStackData()).toEqual([8]);
  });

  test('handles empty block', () => {
    executeProgram('42 3 repeat { }');
    expect(vm.getStackData()).toEqual([42]);
  });

  test('works with nested combinators', () => {
    executeProgram('1 2 repeat { 2 do { add } }');
    expect(vm.getStackData()).toEqual([5]);
  });
});

import { vm, initializeInterpreter } from '../../../core/global-state';
import { executeProgram } from '../../../lang/interpreter';

describe('Do Combinator', () => {
  beforeEach(() => {
    initializeInterpreter();
  });

  test('applies a simple block to a value', () => {
    executeProgram('5 do { 1 add }');
    expect(vm.getStackData()).toEqual([6]);
  });

  test('works with stack manipulation in block', () => {
    executeProgram('2 3 do { dup mul }');
    expect(vm.getStackData()).toEqual([2, 9]);
  });

  test('works with nested combinators', () => {
    executeProgram('4 do { 2 do { add } }');
    expect(vm.getStackData()).toEqual([6]);
  });

  test('handles empty block (should leave value unchanged)', () => {
    executeProgram('7 do { }');
    expect(vm.getStackData()).toEqual([7]);
  });

  test('works with multiple values and a block', () => {
    executeProgram('1 2 3 do { add }');
    expect(vm.getStackData()).toEqual([1, 5]);
  });
});

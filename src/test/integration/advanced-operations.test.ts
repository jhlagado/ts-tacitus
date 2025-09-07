import { runTacitTest } from '../utils/vm-test-utils';

describe('Tacit Advanced Operations', () => {
  test('word definitions', () => {
    let result = runTacitTest(': square dup mul ; 3 square');
    expect(result).toEqual([9]);
    result = runTacitTest(': double 2 mul ; : quadruple double double ; 5 quadruple');
    expect(result).toEqual([20]);
    result = runTacitTest(': swap-and-add swap add ; 3 7 swap-and-add');
    expect(result).toEqual([10]);
  });
  test('complex conditions', () => {
    let result = runTacitTest('1 IF { 2 } ELSE { 3 }');
    expect(result).toEqual([2]);
  });
  test('nested if with code blocks (using new IF syntax)', () => {
    let result = runTacitTest('1 IF { 5 2 add } ELSE { 8 3 sub }');
    expect(result).toEqual([7]);
  });
});


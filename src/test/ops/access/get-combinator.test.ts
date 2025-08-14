/**
 * Tests for get combinator - basic functionality
 */
import { resetVM } from '../../utils/vm-test-utils';
import { executeProgram } from '../../../lang/interpreter';
import { vm } from '../../../core/globalState';
import { fromTaggedValue } from '../../../core/tagged';

describe('get combinator', () => {
  beforeEach(() => {
    resetVM();
  });

  it('get combinator macro: executes block and creates a list (stack layout check)', () => {
    executeProgram('(1 2 3) get { 40 50 }');
    const stack = vm.getStackData();

    // Expect: 3, 2, 1, LIST:3, 5, 4, LIST:2 (TOS is rightmost)
    expect(stack).toHaveLength(7);

    // Check original list (bottom 4 slots)
    expect(fromTaggedValue(stack[0]).value).toBe(3);
    expect(fromTaggedValue(stack[1]).value).toBe(2);
    expect(fromTaggedValue(stack[2]).value).toBe(1);

    // Check block result list (top 3 slots)
    expect(fromTaggedValue(stack[4]).value).toBe(50);
    expect(fromTaggedValue(stack[5]).value).toBe(40);
  });
});

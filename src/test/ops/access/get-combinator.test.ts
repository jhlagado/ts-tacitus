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

  it('get combinator macro: pops two args and pushes 123', () => {
    executeProgram('(1 2 3) get { 1 }');
    const stack = vm.getStackData();
    expect(stack).toHaveLength(1);
    expect(fromTaggedValue(stack[0]).value).toBe(123);
  });
});

import { vm } from '../../core/global-state';
import { resetVM } from '../utils/vm-test-utils';
import { endCaseOp } from '../../ops/core/core-ops';

describe('case end corruption branch', () => {
  beforeEach(() => resetVM());

  test('endCaseOp detects return stack mismatch', () => {
    // Push savedRSP greater than current RSP to trigger mismatch branch
    vm.push(1);
    expect(() => endCaseOp(vm)).toThrow('case corrupted return stack');
  });
});

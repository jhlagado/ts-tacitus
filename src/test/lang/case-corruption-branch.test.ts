import { vm } from '../utils/vm-test-utils';
import { resetVM } from '../utils/vm-test-utils';
import { endCaseOp } from '../../ops/core/core-ops';
import { push } from '../../core/vm';

describe('case end corruption branch', () => {
  beforeEach(() => resetVM());

  test('endCaseOp detects return stack mismatch', () => {
    // Push savedRSP greater than current RSP to trigger mismatch branch
    push(vm, 1);
    expect(() => endCaseOp(vm)).toThrow('case corrupted return stack');
  });
});

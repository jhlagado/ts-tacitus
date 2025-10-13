import { vm } from '../../../core/global-state';
import { resetVM } from '../../utils/vm-test-utils';
import { groupRightOp, endIfOp, endDoOp } from '../../../ops/core/core-ops';

describe('Core ops extra branch coverage', () => {
  beforeEach(() => resetVM());

  test('groupRightOp underflow throws', () => {
    // No entries on return stack → underflow path
    expect(() => groupRightOp(vm)).toThrow();
  });

  test('endIfOp errors on missing placeholder', () => {
    // Push a non-numeric placeholder
    vm.push(NaN);
    expect(() => endIfOp(vm)).toThrow();
  });

  test('endDoOp errors on missing predicate placeholder', () => {
    vm.push(NaN);
    expect(() => endDoOp(vm)).toThrow();
  });
});


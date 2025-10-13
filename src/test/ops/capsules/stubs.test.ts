import { vm } from '../../../core/global-state';
import { exitConstructorOp, exitDispatchOp, dispatchOp, endCapsuleOp } from '../../../ops/capsules/capsule-ops';
import { resetVM } from '../../utils/vm-test-utils';

describe('capsule opcode stubs', () => {
  beforeEach(() => {
    resetVM();
  });

  test('exitConstructorOp throws not implemented', () => {
    expect(() => exitConstructorOp(vm)).toThrow('not implemented');
  });

  test('exitDispatchOp underflow outside prologue', () => {
    expect(() => exitDispatchOp(vm)).toThrow();
  });

  test('dispatchOp underflow without operands', () => {
    expect(() => dispatchOp(vm)).toThrow();
  });

  test('endCapsuleOp errors outside parser context', () => {
    expect(() => endCapsuleOp(vm)).toThrow();
  });
});

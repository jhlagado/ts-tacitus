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

  test('exitDispatchOp throws not implemented', () => {
    expect(() => exitDispatchOp(vm)).toThrow('not implemented');
  });

  test('dispatchOp throws not implemented', () => {
    expect(() => dispatchOp(vm)).toThrow('not implemented');
  });

  test('endCapsuleOp throws not implemented', () => {
    expect(() => endCapsuleOp(vm)).toThrow('not implemented');
  });
});

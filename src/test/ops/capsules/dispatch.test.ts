import { vm } from '../../../core/global-state';
import { resetVM } from '../../utils/vm-test-utils';
import { dispatchOp, exitDispatchOp } from '../../../ops/capsules/capsule-ops';
import {
  Tag,
  toTaggedValue,
  createDataRefAbs,
  RSTACK_BASE,
  STACK_BASE,
  CELL_SIZE,
} from '../../../core';

describe('capsule dispatch runtime', () => {
  beforeEach(() => resetVM());

  const pushCapsuleOnRStack = (locals: number[], codeAddr: number) => {
    // Caller frame begins at current RSP; append locals, CODE, LIST on RSTACK
    for (let i = 0; i < locals.length; i++) vm.rpush(locals[i]);
    const codeRef = toTaggedValue(codeAddr, Tag.CODE);
    vm.rpush(codeRef);
    vm.rpush(toTaggedValue(locals.length + 1, Tag.LIST));
    const handle = createDataRefAbs(RSTACK_BASE / CELL_SIZE + (vm.RSP - 1));
    return { handle, codeRef };
  };

  test('prologue consumes receiver only, preserves method and args', () => {
    const savedIP = 1234;
    vm.IP = savedIP;
    vm.BP = 0;
    // Build capsule with 2 locals (10,20) and entry at 777
    const { handle } = pushCapsuleOnRStack([10, 20], 777);
    // Build data stack: 1 2 'meth handle
    vm.push(1);
    vm.push(2);
    vm.push(42); // pretend method symbol placeholder
    vm.push(handle);

    dispatchOp(vm);

    // method + args remain (receiver consumed)
    const stack = vm.getStackData();
    expect(stack).toEqual([1, 2, 42]);

    // IP jumped to entry address
    expect(vm.IP).toBe(777);

    // Return stack now has saved return address and BP on top
    // Exit epilogue restores IP and BP
    exitDispatchOp(vm);
    expect(vm.IP).toBe(savedIP);
  });

  test('errors on non-capsule receiver', () => {
    vm.push(0);
    vm.push(createDataRefAbs(STACK_BASE / CELL_SIZE + 0));
    expect(() => dispatchOp(vm)).toThrow();
  });
});

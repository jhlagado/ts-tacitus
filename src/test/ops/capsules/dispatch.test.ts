import { vm } from '../../../lang/runtime';
import { resetVM } from '../../utils/vm-test-utils';
import { dispatchOp, exitDispatchOp } from '../../../ops/capsules/capsule-ops';
import {
  Tag,
  toTaggedValue,
  createDataRef,
  RSTACK_BASE,
  STACK_BASE,
  CELL_SIZE,
} from '../../../core';
import { push, rpush, getStackData } from '../../../core/vm';

describe('capsule dispatch runtime', () => {
  beforeEach(() => resetVM());

  const pushCapsuleOnRStack = (locals: number[], codeAddr: number) => {
    // Caller frame begins at current RSP; append locals, CODE, LIST on RSTACK
    for (let i = 0; i < locals.length; i++) rpush(vm, locals[i]);
    const codeRef = toTaggedValue(codeAddr, Tag.CODE);
    rpush(vm, codeRef);
    rpush(vm, toTaggedValue(locals.length + 1, Tag.LIST));
    const handle = createDataRef(vm.rsp - 1);
    return { handle, codeRef };
  };

  test('prologue consumes receiver only, preserves method and args', () => {
    const savedIP = 1234;
    vm.IP = savedIP;
    vm.bp = RSTACK_BASE / CELL_SIZE + 0;
    // Build capsule with 2 locals (10,20) and entry at 777
    const { handle } = pushCapsuleOnRStack([10, 20], 777);
    // Build data stack: 1 2 'meth handle
    push(vm, 1);
    push(vm, 2);
    push(vm, 42); // pretend method symbol placeholder
    push(vm, handle);

    dispatchOp(vm);

    // method + args remain (receiver consumed)
    const stack = getStackData(vm);
    expect(stack).toEqual([1, 2, 42]);

    // IP jumped to entry address
    expect(vm.IP).toBe(777);

    // Return stack now has saved return address and BP on top
    // Exit epilogue restores IP and BP
    exitDispatchOp(vm);
    expect(vm.IP).toBe(savedIP);
  });

  test('errors on non-capsule receiver', () => {
    push(vm, 0);
    push(vm, createDataRef(STACK_BASE / CELL_SIZE + 0));
    expect(() => dispatchOp(vm)).toThrow();
  });
});

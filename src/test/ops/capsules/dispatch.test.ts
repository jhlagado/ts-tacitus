import { createVM, type VM } from '../../../core/vm';
import { dispatchOp, exitDispatchOp } from '../../../ops/capsules/capsule-ops';
import { Tag, Tagged, createRef, RSTACK_BASE, STACK_BASE, CELL_SIZE } from '../../../core';
import { push, rpush, getStackData } from '../../../core/vm';
import { decodeX1516, encodeX1516 } from '../../../core/code-ref';

describe('capsule dispatch runtime', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM();
  });

  const pushCapsuleOnRStack = (locals: number[], codeAddr: number) => {
    // Caller frame begins at current RSP; append locals, CODE, LIST on RSTACK
    for (let i = 0; i < locals.length; i++) rpush(vm, locals[i]);
    const codeRef = Tagged(encodeX1516(codeAddr), Tag.CODE);
    rpush(vm, codeRef);
    rpush(vm, Tagged(locals.length + 1, Tag.LIST));
    const handle = createRef(vm.rsp - 1);
    return { handle, codeRef };
  };

  test('prologue consumes receiver only, preserves method and args', () => {
    const savedIP = 1234;
    vm.IP = savedIP;
    vm.bp = RSTACK_BASE + 0;
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

    // IP jumped to entry address (decoded from X1516)
    expect(vm.IP).toBe(777);

    // Return stack now has saved return address and BP on top
    // Exit epilogue restores IP and BP
    exitDispatchOp(vm);
    expect(vm.IP).toBe(savedIP);
  });

  test('errors on non-capsule receiver', () => {
    push(vm, 0);
    push(vm, createRef(STACK_BASE + 0));
    expect(() => dispatchOp(vm)).toThrow();
  });
});

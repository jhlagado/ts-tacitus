import { createVM, type VM } from '../../../core/vm';
import { readCapsuleLayoutFromHandle } from '../../../ops/capsules/layout';
import { push, rpush } from '../../../core/vm';
import {
  Tag,
  toTaggedValue,
  createRef,
  CELL_SIZE,
  RSTACK_BASE_BYTES,
  RSTACK_BASE,
  STACK_BASE_BYTES,
  STACK_BASE,
} from '../../../core';

describe('capsule layout (handle-based)', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM();
  });

  const pushCapsuleLike = (locals: number[], codeAddr: number) => {
    // Push locals in order (oldest to newest) onto RSTACK
    for (let i = 0; i < locals.length; i++) {
      rpush(vm, locals[i]);
    }
    // Push CODE ref then LIST header (payload = locals + 1)
    const codeRef = toTaggedValue(codeAddr, Tag.CODE);
    rpush(vm, codeRef);
    const slotCount = locals.length + 1;
    const header = toTaggedValue(slotCount, Tag.LIST);
    rpush(vm, header);

    const headerCellIndex = vm.rsp - 1; // absolute cell index at top of RSTACK
    const handle = createRef(headerCellIndex);
    return { handle, slotCount, codeRef };
  };

  test('reads valid capsule layout from REF handle', () => {
    const codeAddr = 1234;
    const { handle, slotCount, codeRef } = pushCapsuleLike([10, 20], codeAddr);

    const layout = readCapsuleLayoutFromHandle(vm, handle);
    expect(layout.slotCount).toBe(slotCount);
    expect(layout.codeRef).toBe(codeRef);
    // Header absolute address must be base + slotCount * CELL_SIZE
    expect(layout.headerAddrBytes).toBe(layout.baseAddrBytes + slotCount * CELL_SIZE);
  });

  test('errors on non-capsule handle (slot0 not CODE)', () => {
    // Construct LIST where slot0 is a NUMBER instead of CODE
    for (const v of [1, 2]) rpush(vm, v);
    rpush(vm, 42); // not CODE
    rpush(vm, toTaggedValue(3, Tag.LIST));
    const headerIdx = vm.rsp - 1;
    const handle = createRef(headerIdx);

    expect(() => readCapsuleLayoutFromHandle(vm, handle)).toThrow('slot0 must be a CODE');
  });

  test('errors on non-list handle (bad reference)', () => {
    const bad = createRef(STACK_BASE + 0);
    expect(() => readCapsuleLayoutFromHandle(vm, bad)).toThrow('does not reference a LIST');
  });

  test('reads capsule layout when list lives on STACK segment', () => {
    // Build a capsule-like list on the data stack: ( CODE 1 )
    const codeRef = toTaggedValue(99, Tag.CODE);
    push(vm, 1);
    push(vm, codeRef);
    push(vm, toTaggedValue(2, Tag.LIST));
    const headerCellIndex = vm.sp - 1; // absolute data stack cell index
    const stackHandle = createRef(headerCellIndex);
    const layout = readCapsuleLayoutFromHandle(vm, stackHandle as unknown as number);
    expect(layout.baseAddrBytes).toBeGreaterThanOrEqual(STACK_BASE_BYTES);
    expect(layout.baseAddrBytes).toBeLessThan(RSTACK_BASE_BYTES);
    expect(layout.codeRef).toBe(codeRef);
    expect(layout.slotCount).toBe(2);
  });

  test('errors when payload slot count is zero', () => {
    // header LIST:0 on RSTACK (no payload)
    rpush(vm, toTaggedValue(0, Tag.LIST));
    const handle = createRef(vm.rsp - 1);
    expect(() => readCapsuleLayoutFromHandle(vm, handle)).toThrow('include CODE slot');
  });

  test('errors when return-stack REF does not point to a LIST header', () => {
    rpush(vm, 12345); // simple value on RSTACK
    const handle = createRef(vm.rsp - 1);
    expect(() => readCapsuleLayoutFromHandle(vm, handle)).toThrow('does not reference a LIST');
  });
});

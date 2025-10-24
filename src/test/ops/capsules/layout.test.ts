import { vm } from '../../../core/global-state';
import { resetVM } from '../../utils/vm-test-utils';
import { readCapsuleLayoutFromHandle } from '../../../ops/capsules/layout';
import {
  Tag,
  toTaggedValue,
  createDataRefAbs,
  CELL_SIZE,
  RSTACK_BASE,
  STACK_BASE,
} from '../../../core';

describe('capsule layout (handle-based)', () => {
  beforeEach(() => {
    resetVM();
  });

  const pushCapsuleLike = (locals: number[], codeAddr: number) => {
    // Push locals in order (oldest to newest) onto RSTACK
    for (let i = 0; i < locals.length; i++) {
      vm.rpush(locals[i]);
    }
    // Push CODE ref then LIST header (payload = locals + 1)
    const codeRef = toTaggedValue(codeAddr, Tag.CODE);
    vm.rpush(codeRef);
    const slotCount = locals.length + 1;
    const header = toTaggedValue(slotCount, Tag.LIST);
    vm.rpush(header);

    const headerCellIndex = vm.RSP - 1; // header is at top of RSTACK
    const handle = createDataRefAbs(RSTACK_BASE / CELL_SIZE + headerCellIndex);
    return { handle, slotCount, codeRef };
  };

  test('reads valid capsule layout from DATA_REF handle', () => {
    const codeAddr = 1234;
    const { handle, slotCount, codeRef } = pushCapsuleLike([10, 20], codeAddr);

    const layout = readCapsuleLayoutFromHandle(vm, handle);
    expect(layout.segment).toBe(1);
    expect(layout.slotCount).toBe(slotCount);
    expect(layout.codeRef).toBe(codeRef);
    // Header address must be baseAddr + slotCount * CELL_SIZE
    expect(layout.headerAddr).toBe(layout.baseAddr + slotCount * CELL_SIZE);
  });

  test('errors on non-capsule handle (slot0 not CODE)', () => {
    // Construct LIST where slot0 is a NUMBER instead of CODE
    for (const v of [1, 2]) vm.rpush(v);
    vm.rpush(42); // not CODE
    vm.rpush(toTaggedValue(3, Tag.LIST));
    const headerIdx = vm.RSP - 1;
    const handle = createDataRefAbs(RSTACK_BASE / CELL_SIZE + headerIdx);

    expect(() => readCapsuleLayoutFromHandle(vm, handle)).toThrow('slot0 must be a CODE');
  });

  test('errors on non-list handle (bad reference)', () => {
    const bad = createDataRefAbs(STACK_BASE / CELL_SIZE + 0);
    expect(() => readCapsuleLayoutFromHandle(vm, bad)).toThrow('does not reference a LIST');
  });

  test('reads capsule layout when list lives on STACK segment', () => {
    // Build a capsule-like list on the data stack: ( CODE 1 )
    const codeRef = toTaggedValue(99, Tag.CODE);
    vm.push(1);
    vm.push(codeRef);
    vm.push(toTaggedValue(2, Tag.LIST));
    const headerCellIndex = vm.SP - 1; // data stack cell index
    const stackHandle = createDataRefAbs(STACK_BASE / CELL_SIZE + headerCellIndex);
    const layout = readCapsuleLayoutFromHandle(vm, stackHandle as unknown as number);
    expect(layout.segment).toBe(0); // SEG_STACK
    expect(layout.codeRef).toBe(codeRef);
    expect(layout.slotCount).toBe(2);
  });

  test('errors when payload slot count is zero', () => {
    // header LIST:0 on RSTACK (no payload)
    vm.rpush(toTaggedValue(0, Tag.LIST));
    const handle = createDataRefAbs(RSTACK_BASE / CELL_SIZE + (vm.RSP - 1));
    expect(() => readCapsuleLayoutFromHandle(vm, handle)).toThrow('include CODE slot');
  });

  test('errors when return-stack DATA_REF does not point to a LIST header', () => {
    vm.rpush(12345); // simple value on RSTACK
    const handle = createDataRefAbs(RSTACK_BASE / CELL_SIZE + (vm.RSP - 1));
    expect(() => readCapsuleLayoutFromHandle(vm, handle)).toThrow('does not reference a LIST');
  });
});

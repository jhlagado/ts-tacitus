import { vm } from '../../../core/global-state';
import { resetVM } from '../../utils/vm-test-utils';
import { readCapsuleLayoutFromHandle } from '../../../ops/capsules/layout';
import { Tag, toTaggedValue, SEG_RSTACK, CELL_SIZE } from '../../../core';

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
    const handle = toTaggedValue(headerCellIndex, Tag.RSTACK_REF);
    return { handle, slotCount, codeRef };
  };

  test('reads valid capsule layout from RSTACK_REF handle', () => {
    const codeAddr = 1234;
    const { handle, slotCount, codeRef } = pushCapsuleLike([10, 20], codeAddr);

    const layout = readCapsuleLayoutFromHandle(vm, handle);
    expect(layout.segment).toBe(SEG_RSTACK);
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
    const handle = toTaggedValue(headerIdx, Tag.RSTACK_REF);

    expect(() => readCapsuleLayoutFromHandle(vm, handle)).toThrow('slot0 must be a CODE');
  });

  test('errors on non-RSTACK_REF input', () => {
    const bad = toTaggedValue(0, Tag.STACK_REF);
    expect(() => readCapsuleLayoutFromHandle(vm, bad)).toThrow('RSTACK_REF');
  });
});

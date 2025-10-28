import { vm } from '../../../lang/runtime';
import { resetVM, executeTacitWithState } from '../../utils/vm-test-utils';
import { readCapsuleLayoutFromHandle } from '../../../ops/capsules/layout';
import {
  fromTaggedValue,
  Tag,
  getRefSegment,
  RSTACK_BASE,
  RSTACK_SIZE,
  getByteAddressFromRef,
} from '../../../core';
import { CELL_SIZE } from '../../../core/constants';

describe('Capsule constructor (language-level) — minimal to locals', () => {
  beforeEach(() => resetVM());

  test('zero locals: capsule returns return-stack DATA_REF handle; layout LIST:1 (CODE only)', () => {
    const code = `
      : mk
        capsule
        ;
        mk
    `;
    const state = executeTacitWithState(code);
    expect(state.stack.length).toBe(1);
    const handle = state.stack[0];
    const { tag } = fromTaggedValue(handle);
    expect(tag).toBe(Tag.DATA_REF);
    // Return-stack handle: classify without SEG_RSTACK constant
    expect(getRefSegment(handle)).toBe(1);
    const abs = getByteAddressFromRef(handle);
    expect(abs).toBeGreaterThanOrEqual(RSTACK_BASE);
    expect(abs).toBeLessThan(RSTACK_BASE + RSTACK_SIZE);

    const layout = readCapsuleLayoutFromHandle(vm, handle);
    expect(layout.slotCount).toBe(1); // CODE only
  });

  test('two locals: layout LIST:3 (locals 2 + CODE 1)', () => {
    const code = `
      : mk2
        10 var a
        20 var b
        capsule
        ;
        mk2
    `;
    const state = executeTacitWithState(code);
    expect(state.stack.length).toBe(1);
    const handle = state.stack[0];
    const { tag } = fromTaggedValue(handle);
    expect(tag).toBe(Tag.DATA_REF);
    expect(getRefSegment(handle)).toBe(1);

    const layout = readCapsuleLayoutFromHandle(vm, handle);
    expect(layout.slotCount).toBe(3); // a, b, CODE
    // Caller BP restored (top-level remains at base)
    expect(vm.bp).toBe(RSTACK_BASE / CELL_SIZE + 0);
  });
});

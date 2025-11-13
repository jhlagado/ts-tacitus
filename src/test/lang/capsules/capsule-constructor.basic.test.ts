import { createVM, type VM } from '../../../core/vm';
import { executeTacitWithState } from '../../utils/vm-test-utils';
import { readCapsuleLayoutFromHandle } from '../../../ops/capsules/layout';
import {
  getTaggedInfo,
  Tag,
  isRStackRef,
  RSTACK_BASE_BYTES,
  RSTACK_BASE,
  RSTACK_SIZE_BYTES,
  refToByte,
} from '../../../core';

describe('Capsule constructor (language-level) — minimal to locals', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM();
  });

  test('zero locals: capsule returns return-stack REF handle; layout LIST:1 (CODE only)', () => {
    const code = `
      : mk
        capsule
        ;
        mk
    `;
    const state = executeTacitWithState(vm, code);
    expect(state.stack.length).toBe(1);
    const handle = state.stack[0];
    const { tag } = getTaggedInfo(handle);
    expect(tag).toBe(Tag.REF);
    // Return-stack handle: classify without SEG_RSTACK constant
    expect(isRStackRef(handle)).toBe(true);
    const abs = refToByte(handle);
    expect(abs).toBeGreaterThanOrEqual(RSTACK_BASE_BYTES);
    expect(abs).toBeLessThan(RSTACK_BASE_BYTES + RSTACK_SIZE_BYTES);

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
    const state = executeTacitWithState(vm, code);
    expect(state.stack.length).toBe(1);
    const handle = state.stack[0];
    const { tag } = getTaggedInfo(handle);
    expect(tag).toBe(Tag.REF);
    expect(isRStackRef(handle)).toBe(true);

    const layout = readCapsuleLayoutFromHandle(vm, handle);
    expect(layout.slotCount).toBe(3); // a, b, CODE
    // Caller BP restored (top-level remains at base)
    expect(vm.bp).toBe(RSTACK_BASE + 0);
  });
});

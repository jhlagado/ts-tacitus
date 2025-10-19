import { vm } from '../../../core/global-state';
import { resetVM, executeTacitWithState } from '../../utils/vm-test-utils';
import { readCapsuleLayoutFromHandle } from '../../../ops/capsules/layout';
import { decodeDataRef, fromTaggedValue, Tag, SEG_RSTACK } from '../../../core';

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
    expect(decodeDataRef(handle).segment).toBe(SEG_RSTACK);

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
    expect(decodeDataRef(handle).segment).toBe(SEG_RSTACK);

    const layout = readCapsuleLayoutFromHandle(vm, handle);
    expect(layout.slotCount).toBe(3); // a, b, CODE
    // Caller BP restored (top-level remains 0)
    expect(vm.BP).toBe(0);
  });
});

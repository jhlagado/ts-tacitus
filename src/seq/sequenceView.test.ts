import { vm, initializeInterpreter } from '../core/globalState';
import { vectorCreate } from '../heap/vector';
import { fromTaggedValue, isNIL } from '../core/tagged';
import { SequenceView } from './sequenceView';

describe('SequenceView', () => {
  beforeEach(() => initializeInterpreter());

  it('reads header elements correctly', () => {
    // Construct a fake sequence header: [ type, metaCount, meta0, meta1 ]
    const headerData = [42, 2, 7, 8];
    const taggedVec = vectorCreate(vm.heap, headerData);
    expect(isNIL(taggedVec)).toBe(false);

    const { value: addr } = fromTaggedValue(taggedVec);
    const view = new SequenceView(vm.heap, addr);

    expect(view.type).toBe(42);
    expect(view.metaCount).toBe(2);
    expect(view.meta(0)).toBe(7);
    expect(view.meta(1)).toBe(8);
  });
});

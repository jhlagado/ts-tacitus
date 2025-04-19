import { vm, initializeInterpreter } from '../core/globalState';
import { vectorCreate } from './vector';
import { fromTaggedValue, isNIL } from '../core/tagged';
import { VectorView } from './vectorView';
import { BLOCK_SIZE } from './heap';
import { VEC_DATA } from './vector';

describe('VectorView', () => {
  beforeEach(() => initializeInterpreter());

  it('reads elements correctly in a single block', () => {
    const data = [10, 20, 30, 40];
    const tagged = vectorCreate(vm.heap, data);
    expect(isNIL(tagged)).toBe(false);

    const { value: addr } = fromTaggedValue(tagged);
    const view = new VectorView(vm.heap, addr);

    expect(view.length).toBe(data.length);
    for (let i = 0; i < data.length; i++) {
      expect(view.element(i)).toBe(data[i]);
    }
  });

  it('reads elements correctly across multiple blocks', () => {
    // compute how many elements fit per block
    const ELEMENTS_PER_BLOCK = Math.floor((BLOCK_SIZE - VEC_DATA) / 4);
    const total = ELEMENTS_PER_BLOCK * 2 + 5;
    const data = Array.from({ length: total }, (_, i) => i * 3 + 1);

    const tagged = vectorCreate(vm.heap, data);
    expect(isNIL(tagged)).toBe(false);

    const { value: addr } = fromTaggedValue(tagged);
    const view = new VectorView(vm.heap, addr);

    expect(view.length).toBe(total);
    for (let i = 0; i < total; i++) {
      expect(view.element(i)).toBe(data[i]);
    }
  });

  it('throws on out‐of‐bounds index', () => {
    const data = [1, 2, 3];
    const tagged = vectorCreate(vm.heap, data);
    const { value: addr } = fromTaggedValue(tagged);
    const view = new VectorView(vm.heap, addr);

    expect(() => view.element(10)).toThrowError(/bad block at index 10/);
  });
});

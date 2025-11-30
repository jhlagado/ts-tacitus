import { describe, it, expect } from '@jest/globals';
import { createVM, push } from '../../../core/vm';
import { Tagged, Tag } from '../../../core/tagged';
import { binaryRecursive } from '../../../ops/broadcast';

describe('broadcast type error coverage', () => {
  it('binaryFlat throws on non-number payload', () => {
    const vm = createVM();
    // simple × simple non-numeric pair triggers mismatch
    push(vm, Tagged(0, Tag.STRING)); // a (non-number)
    push(vm, 1); // b (number)
    expect(() => binaryRecursive(vm, 'add', (a, b) => a + b)).toThrow('broadcast type mismatch');
  });
});

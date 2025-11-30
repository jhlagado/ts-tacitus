import { describe, it, expect } from '@jest/globals';
import { createVM } from '../../core/vm';
import {
  hideDictionaryHead,
  unhideDictionaryHead,
  forget,
  mark,
  define,
  lookup,
} from '../../core/dictionary';
import { Tagged, Tag } from '../../core/tagged';

describe('dictionary coverage branches', () => {
  it('throws when hiding or unhiding an empty dictionary', () => {
    const vm = createVM();
    vm.compile.head = 0;
    expect(() => hideDictionaryHead(vm)).toThrow('dictionary is empty');
    expect(() => unhideDictionaryHead(vm)).toThrow('dictionary is empty');
  });

  it('forget validates marks and adjusts head', () => {
    const vm = createVM();
    const mark0 = mark(vm);
    expect(() => forget(vm, -1)).toThrow('forget mark out of range');
    expect(() => forget(vm, mark0 + 1)).toThrow('forget mark beyond current heap top');

    // populate dictionary, then forget to mark
    define(vm, '__cov_a', Tagged(1, Tag.NUMBER));
    const m1 = mark(vm);
    define(vm, '__cov_b', Tagged(2, Tag.NUMBER));
    expect(lookup(vm, '__cov_b')).not.toBeUndefined();
    forget(vm, m1);
    // entry b is gone, head rewound
    const b = lookup(vm, '__cov_b');
    expect(Number.isNaN(b)).toBe(true); // NIL when missing
    const a = lookup(vm, '__cov_a');
    expect(Number.isNaN(a)).toBe(false);
  });
});

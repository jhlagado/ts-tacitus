import { beforeEach, describe, expect, test } from '@jest/globals';
import { createVM, type VM } from '../../core/vm';
import {
  define,
  hideDictionaryHead,
  unhideDictionaryHead,
  getDictionaryEntryInfo,
  forget,
} from '../../core/dictionary';
import { Tagged, Tag } from '../../core/tagged';
import { memoryWriteCell } from '../../core';

describe('dictionary edge branches', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM(false);
  });

  test('hide/unhide throw on empty dictionary and succeed when populated', () => {
    vm.head = 0;
    vm.gp = 0;
    expect(() => hideDictionaryHead(vm)).toThrow('dictionary is empty');
    expect(() => unhideDictionaryHead(vm)).toThrow('dictionary is empty');

    define(vm, 'a', Tagged(1, Tag.NUMBER));
    expect(() => hideDictionaryHead(vm)).not.toThrow();
    const infoHidden = getDictionaryEntryInfo(vm, vm.head);
    expect(infoHidden.hidden).toBe(true);

    expect(() => unhideDictionaryHead(vm)).not.toThrow();
    const infoShown = getDictionaryEntryInfo(vm, vm.head);
    expect(infoShown.hidden).toBe(false);
  });

  test('getDictionaryEntryInfo validates index and name tag', () => {
    expect(() => getDictionaryEntryInfo(vm, 0)).toThrow('Dictionary entry index 0');

    define(vm, 'bad', Tagged(1, Tag.NUMBER));
    // Corrupt name cell to ensure tag check throws
    const headerCell = vm.head;
    const baseCell = headerCell - 3;
    memoryWriteCell(vm.memory, baseCell + 2, Tagged(99, Tag.NUMBER));
    expect(() => getDictionaryEntryInfo(vm, vm.head)).toThrow('Dictionary entry name must be STRING');
  });

  test('forget validates mark bounds', () => {
    expect(() => forget(vm, -1)).toThrow('forget mark out of range');
    expect(() => forget(vm, vm.gp + 10)).toThrow('forget mark beyond current heap top');
  });
});

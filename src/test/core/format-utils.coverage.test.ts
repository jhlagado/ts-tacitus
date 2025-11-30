import { describe, it, expect } from '@jest/globals';
import { createVM, push } from '../../core/vm';
import { Tagged, Tag } from '../../core/tagged';
import { createRef } from '../../core/refs';
import { formatValue, formatAtomicValue } from '../../core/format-utils';
import { pushListLiteral } from '../utils/vm-test-utils';

describe('format-utils coverage', () => {
  it('formats zero-slot list directly', () => {
    const vm = createVM();
    const emptyList = Tagged(0, Tag.LIST);
    expect(formatValue(vm, emptyList)).toBe('()');
  });

  it('formats list via REF materialization path', () => {
    const vm = createVM();
    pushListLiteral(vm, 1, 2); // leaves payload then header on stack
    const ref = createRef(vm.sp - 1); // header cell
    const formatted = formatValue(vm, ref);
    // pushListLiteral lays payload on stack in reverse, so formatting yields ( 2 1 )
    expect(formatted).toBe('( 2 1 )');
  });

  it('formats unknown string payload and fallback atomics', () => {
    const vm = createVM();
    // STRING with missing digest entry falls back to [String:idx]
    const missingStr = Tagged(999, Tag.STRING);
    expect(formatAtomicValue(vm, missingStr)).toBe('[String:999]');
    // default path for unhandled tag
    const sentinel = Tagged(5, Tag.SENTINEL);
    expect(formatAtomicValue(vm, sentinel)).toBe('[SENTINEL:5]');
  });
});

import { initializeInterpreter, vm } from '../../core/global-state';
import { formatAtomicValue, formatValue, formatList } from '../../core';
import { Tag, toTaggedValue, createDataRef, SEG_STACK } from '../../core';

describe('format-utils additional coverage', () => {
  beforeEach(() => {
    initializeInterpreter();
  });

  test('formats near-integer floats by rounding', () => {
    const v = toTaggedValue(3.00005, Tag.NUMBER);
    expect(formatAtomicValue(vm, v)).toBe('3');
  });

  test('formats tiny floats with fixed then trim', () => {
    const v = toTaggedValue(0.00009, Tag.NUMBER);
    // 0.00009 -> toFixed(2) => '0.00' -> trim zeros => '0'
    expect(formatAtomicValue(vm, v)).toBe('0');
  });

  // Note: Explicit NaN formatting is not stable with NaN-boxed scheme; skip.

  test('formats LIST via reference from memory', () => {
    // Layout: [e1, e2, e3, header]
    const e1 = toTaggedValue(1, Tag.NUMBER);
    const e2 = toTaggedValue(2, Tag.NUMBER);
    const e3 = toTaggedValue(3, Tag.NUMBER);
    const header = toTaggedValue(3, Tag.LIST);

    // Place at cells 7..10 so address = cellIndex*4
    const baseCell = 10; // header cell index
    vm.memory.writeFloat32(SEG_STACK, (baseCell - 3) * 4, e1);
    vm.memory.writeFloat32(SEG_STACK, (baseCell - 2) * 4, e2);
    vm.memory.writeFloat32(SEG_STACK, (baseCell - 1) * 4, e3);
    vm.memory.writeFloat32(SEG_STACK, baseCell * 4, header);

    const ref = createDataRef(SEG_STACK, baseCell);
    // Memory-based formatting consumes from stack (LIFO), so order reverses
    expect(formatValue(vm, ref)).toBe('( 3 2 1 )');
  });

  test('formats atomic via reference from memory (non-list)', () => {
    const cell = 20;
    const num = toTaggedValue(42, Tag.NUMBER);
    vm.memory.writeFloat32(SEG_STACK, cell * 4, num);
    const ref = createDataRef(SEG_STACK, cell);
    expect(formatValue(vm, ref)).toBe('42');
  });

  test('formats strings with carriage return escape', () => {
    const s = 'line1\rline2';
    const addr = vm.digest.intern(s);
    const tagged = toTaggedValue(addr, Tag.STRING);
    expect(formatValue(vm, tagged)).toBe('"line1\\rline2"');
  });

  test('formatList returns empty list when SP insufficient', () => {
    // No values on stack; header claims 1 slot
    const header = toTaggedValue(1, Tag.LIST);
    expect(formatList(vm, header)).toBe('(  )');
  });
});

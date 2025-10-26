import { initializeInterpreter, vm } from '../../core/global-state';
import { formatAtomicValue, formatValue, formatList } from '../../core';
import { Tag, toTaggedValue, createDataRef, SEG_DATA, STACK_BASE, CELL_SIZE } from '../../core';

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
    vm.memory.writeFloat32(SEG_DATA, STACK_BASE + (baseCell - 3) * 4, e1);
    vm.memory.writeFloat32(SEG_DATA, STACK_BASE + (baseCell - 2) * 4, e2);
    vm.memory.writeFloat32(SEG_DATA, STACK_BASE + (baseCell - 1) * 4, e3);
    vm.memory.writeFloat32(SEG_DATA, STACK_BASE + baseCell * 4, header);

  const ref = createDataRef(STACK_BASE / CELL_SIZE + baseCell);
    // Memory-based formatting consumes from stack (LIFO), so order reverses
    expect(formatValue(vm, ref)).toBe('( 3 2 1 )');
  });

  test('formats atomic via reference from memory (non-list)', () => {
    const cell = 20;
    const num = toTaggedValue(42, Tag.NUMBER);
    vm.memory.writeFloat32(SEG_DATA, STACK_BASE + cell * 4, num);
  const ref = createDataRef(STACK_BASE / CELL_SIZE + cell);
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

  test('formatValue handles empty LIST header on stack (formatListFromStack early return)', () => {
    // Push only a LIST header with zero slots at TOS
    const emptyHeader = toTaggedValue(0, Tag.LIST);
    vm.push(emptyHeader);
    expect(formatValue(vm, emptyHeader)).toBe('()');
  });

  test('formatValue handles empty LIST via memory reference (formatListFromMemory early return)', () => {
    // Write an empty LIST header at some memory cell and reference it
    const baseCell = 40;
    const emptyHeader = toTaggedValue(0, Tag.LIST);
    vm.memory.writeFloat32(SEG_DATA, STACK_BASE + baseCell * 4, emptyHeader);
  const ref = createDataRef(STACK_BASE / CELL_SIZE + baseCell);
    expect(formatValue(vm, ref)).toBe('()');
  });

  test('formatValue handles nested LIST from stack (formatListFromStack recursion branch)', () => {
    // Build stack layout for nested list: ( ( 2 3 ) )
    // Stack bottom ... [ 2, 3, LIST:2, LIST:1 ] <- TOS
    const two = toTaggedValue(2, Tag.NUMBER);
    const three = toTaggedValue(3, Tag.NUMBER);
    const innerHeader = toTaggedValue(2, Tag.LIST);
    const outerHeader = toTaggedValue(1, Tag.LIST);

    vm.push(two);
    vm.push(three);
    vm.push(innerHeader);
    vm.push(outerHeader);

    expect(formatValue(vm, outerHeader)).toBe('( ( 3 2 ) )');
  });
});

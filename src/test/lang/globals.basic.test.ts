import { describe, test, expect } from '@jest/globals';
import { executeTacitCode, resetVM } from '../utils/vm-test-utils';
import { vm } from '../../core/global-state';
import {
  decodeDataRef,
  CELL_SIZE,
  toTaggedValue,
  Tag,
  NIL,
  getTag,
  fromTaggedValue,
  SEG_DATA,
  GLOBAL_BASE,
  getRefRegion,
} from '../../core';
import { Tokenizer } from '../../lang/tokenizer';
import { parse } from '../../lang/parser';
import { execute } from '../../lang/interpreter';

describe('Global variables (unified data + GLOBAL_REF)', () => {
  test('declare and read at top level', () => {
    const result = executeTacitCode(`
      100 global a
      a
    `);
    expect(result).toEqual([100]);
  });

  test('assign at top level', () => {
    const result = executeTacitCode(`
      5 global g
      200 -> g
      g
    `);
    expect(result).toEqual([200]);
  });

  test('access inside function', () => {
    const result = executeTacitCode(`
      42 global answer
      : f answer ;
      f
    `);
    expect(result).toEqual([42]);
  });

  test('compound global initialization supports list semantics', () => {
    const result = executeTacitCode(`
      ( 1 2 ) global xs
      xs length
    `);
    expect(result[0]).toEqual(2);
  });

  test('bracket-path update of global list element (path exercised)', () => {
    const result = executeTacitCode(`
      ( 1 2 ) global xs
      9 -> xs[0]
      xs length
    `);
    expect(result[0]).toEqual(2);
  });

  test('incompatible compound reassignment errors', () => {
    expect(() =>
      executeTacitCode(`
      ( 1 2 ) global xs
      ( 1 2 3 ) -> xs
    `),
    ).toThrow(/Incompatible compound assignment/);
  });

  test('simple to compound mismatch errors', () => {
    expect(() =>
      executeTacitCode(`
      ( 1 2 ) global xs
      42 -> xs
    `),
    ).toThrow(/Cannot assign simple to compound or compound to simple/);
  });

  test('global segment exhaustion throws on compound init overflow', () => {
    const make32 = Array.from({ length: 32 }, () => '1').join(' ');
    const code = `
      ( ${make32} ) global g1
      ( ${make32} ) global g2
    `;
    expect(() => executeTacitCode(code)).toThrow(/Global heap exhausted/);
  });

  test('global dictionary entry stored on heap with payload cell', () => {
    resetVM();
    parse(
      new Tokenizer(`
      100 global alpha
    `),
    );
    execute(vm.compiler.BCP);
    const entryRef = vm.symbolTable.getDictionaryEntryRef('alpha');
    expect(entryRef).toBeDefined();
    const { absoluteCellIndex: headerAbsCellIndex } = decodeDataRef(entryRef!);
    expect(getRefRegion(entryRef!)).toBe('global');
    const headerCellIndex = headerAbsCellIndex - GLOBAL_BASE / CELL_SIZE;

    const payloadCellIndex = headerCellIndex - 3;
    const nameCellIndex = headerCellIndex - 2;
    const prevCellIndex = headerCellIndex - 1;

    const payloadValue = vm.memory.readFloat32(
      SEG_DATA,
      GLOBAL_BASE + payloadCellIndex * CELL_SIZE,
    );
    expect(payloadValue).toBe(100);

    const nameValue = vm.memory.readFloat32(SEG_DATA, GLOBAL_BASE + nameCellIndex * CELL_SIZE);
    expect(getTag(nameValue)).toBe(Tag.STRING);
    const { value: nameAddr } = fromTaggedValue(nameValue);
    expect(vm.digest.get(nameAddr)).toBe('alpha');

    const prevValue = vm.memory.readFloat32(SEG_DATA, GLOBAL_BASE + prevCellIndex * CELL_SIZE);
    expect(prevValue).toBe(NIL);

    const headerValue = vm.memory.readFloat32(SEG_DATA, GLOBAL_BASE + headerCellIndex * CELL_SIZE);
    expect(headerValue).toBe(toTaggedValue(3, Tag.LIST));
  });

  test('global dictionary entries chain via prev pointer', () => {
    resetVM();
    parse(
      new Tokenizer(`
      1 global first
    `),
    );
    execute(vm.compiler.BCP);

    const firstEntryRef = vm.symbolTable.getDictionaryEntryRef('first');
    expect(firstEntryRef).toBeDefined();
    const { absoluteCellIndex: firstAbsIndex } = decodeDataRef(firstEntryRef!);
    expect(getRefRegion(firstEntryRef!)).toBe('global');
    const firstHeaderIndex = firstAbsIndex - GLOBAL_BASE / CELL_SIZE;

    parse(
      new Tokenizer(`
      2 global second
    `),
    );
    execute(vm.compiler.BCP);

    const secondEntryRef = vm.symbolTable.getDictionaryEntryRef('second');
    expect(secondEntryRef).toBeDefined();
    const { absoluteCellIndex: secondAbsIndex } = decodeDataRef(secondEntryRef!);
    expect(getRefRegion(secondEntryRef!)).toBe('global');
    const secondHeaderIndex = secondAbsIndex - GLOBAL_BASE / CELL_SIZE;
    expect(secondHeaderIndex).toBeGreaterThan(firstHeaderIndex);

    const prevValue = vm.memory.readFloat32(
      SEG_DATA,
      GLOBAL_BASE + (secondHeaderIndex - 1) * CELL_SIZE,
    );
    expect(getTag(prevValue)).toBe(Tag.DATA_REF);

    const { absoluteCellIndex: linkedAbsIndex } = decodeDataRef(prevValue);
    const linkedHeaderIndex = linkedAbsIndex - GLOBAL_BASE / CELL_SIZE;
    expect(linkedHeaderIndex).toBe(firstHeaderIndex);

    const priorPrev = vm.memory.readFloat32(
      SEG_DATA,
      GLOBAL_BASE + (firstHeaderIndex - 1) * CELL_SIZE,
    );
    expect(getTag(priorPrev)).toBe(Tag.SENTINEL);
  });
});

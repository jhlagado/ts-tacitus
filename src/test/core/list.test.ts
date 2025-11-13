/**
 * @file src/test/core/list.test.ts
 * Tests for LIST core utilities
 */

import {
  VM,
  Tagged,
  Tag,
  getTaggedInfo,
  CELL_SIZE,
  SEG_DATA,
  STACK_BASE_BYTES,
  STACK_BASE,
  GLOBAL_BASE_BYTES,
  GLOBAL_BASE,
} from '../../core';
import {
  getListLength,
  dropList,
  validateListHeader,
  reverseSpan,
  isList,
  createVM,
  getListElemCell,
  getListBounds,
} from '../../core';
import { createList } from '../utils/core-test-utils';
import { getStackData, peek, push, pop } from '../../core/vm';
import { createRef } from '../../core/refs';
import { executeTacitCode } from '../utils/vm-test-utils';

function getStackDepth(vm: VM): number {
  return getStackData(vm).length;
}

describe('LIST Core Utilities', () => {
  test('should correctly identify LIST types', () => {
    const list = Tagged(5, Tag.LIST);
    const integer = 5;

    expect(isList(list)).toBe(true);
    expect(isList(integer)).toBe(false);
  });

  test('should handle LIST with zero slot count', () => {
    const emptyList = Tagged(0, Tag.LIST);
    expect(isList(emptyList)).toBe(true);

    const decoded = getTaggedInfo(emptyList);
    expect(decoded.tag).toBe(Tag.LIST);
    expect(decoded.value).toBe(0);
  });

  test('should handle LIST with maximum slot count', () => {
    const maxList = Tagged(65535, Tag.LIST);
    expect(isList(maxList)).toBe(true);

    const decoded = getTaggedInfo(maxList);
    expect(decoded.tag).toBe(Tag.LIST);
    expect(decoded.value).toBe(65535);
  });

  test('should validate LIST value ranges', () => {
    expect(() => Tagged(-1, Tag.LIST)).toThrow();
    expect(() => Tagged(65536, Tag.LIST)).toThrow();
  });

  test('should include LIST in encoded/decoded round-trip tests', () => {
    const tests = [
      { tag: Tag.LIST, value: 0 },
      { tag: Tag.LIST, value: 1 },
      { tag: Tag.LIST, value: 65535 },
    ];

    tests.forEach(({ tag, value }) => {
      const encoded = Tagged(value, tag);
      const decoded = getTaggedInfo(encoded);
      expect(decoded.tag).toBe(tag);
      expect(decoded.value).toBe(value);
      expect(isList(encoded)).toBe(true);
    });
  });

  describe('createList', () => {
    it('should create empty LIST', () => {
      const vm = createVM();
      createList(vm, []);

      expect(getStackDepth(vm)).toBe(1);
      const header = peek(vm);
      expect(getListLength(header)).toBe(0);
    });

    it('should create LIST with single value', () => {
      const vm = createVM();
      const value = 42;
      createList(vm, [value]);

      expect(getStackDepth(vm)).toBe(2);
      const header = peek(vm);
      expect(getListLength(header)).toBe(1);

      const payload = vm.memory.readCell(vm.sp - 1);
      expect(isList(payload)).toBe(true);
      expect(getListLength(payload)).toBe(1);
    });

    it('should create LIST with multiple values in reverse order', () => {
      const vm = createVM();
      const val1 = 1;
      const val2 = 2;
      const val3 = 3;

      createList(vm, [val1, val2, val3]);

      expect(getStackDepth(vm)).toBe(4);
      const header = peek(vm);
      expect(isList(header)).toBe(true);
      expect(getListLength(header)).toBe(3);

      const payload0 = vm.memory.readCell(vm.sp - 1);
      const payload1 = vm.memory.readCell(vm.sp - 2);
      const payload2 = vm.memory.readCell(vm.sp - 3);
      const payload3 = vm.memory.readCell(vm.sp - 4);

      expect(isList(payload0)).toBe(true);
      expect(payload1).toBe(val1);
      expect(payload2).toBe(val2);
      expect(payload3).toBe(val3);
    });

    it('should handle mixed tag types', () => {
      const vm = createVM();
      const intVal = 42;
      const numVal = 3.14;
      const strVal = Tagged(100, Tag.STRING);

      createList(vm, [intVal, numVal, strVal]);

      expect(getStackDepth(vm)).toBe(4);
      const header = peek(vm);
      expect(getListLength(header)).toBe(3);
    });
  });

  describe('getListSlotCount', () => {
    it('should extract slot count from LIST header', () => {
      const header = Tagged(5, Tag.LIST);
      expect(getListLength(header)).toBe(5);
    });

    it('should handle zero slot count', () => {
      const header = Tagged(0, Tag.LIST);
      expect(getListLength(header)).toBe(0);
    });

    it('should handle maximum slot count', () => {
      const header = Tagged(65535, Tag.LIST);
      expect(getListLength(header)).toBe(65535);
    });

    it('should throw on non-LIST header', () => {
      const nonList = Tagged(5, Tag.STRING);
      expect(() => getListLength(nonList)).toThrow('Expected LIST header');
    });
  });

  describe('dropList', () => {
    it('should skip empty LIST', () => {
      const vm = createVM();
      createList(vm, []);

      const initialSP = vm.sp - STACK_BASE;
      dropList(vm);
      const finalSP = vm.sp - STACK_BASE;

      expect(initialSP - finalSP).toBe(1);
      expect(getStackDepth(vm)).toBe(0);
    });

    it('should skip LIST with single value', () => {
      const vm = createVM();
      const value = 42;
      createList(vm, [value]);

      const initialSP = vm.sp - STACK_BASE;
      dropList(vm);
      const finalSP = vm.sp - STACK_BASE;

      expect(initialSP - finalSP).toBe(2);
      expect(getStackDepth(vm)).toBe(0);
    });

    it('should skip LIST with multiple values', () => {
      const vm = createVM();
      const values = [1, 2, 3];
      createList(vm, values);

      const initialSP = vm.sp - STACK_BASE;
      dropList(vm);
      const finalSP = vm.sp - STACK_BASE;

      expect(initialSP - finalSP).toBe(4);
      expect(getStackDepth(vm)).toBe(0);
    });

    it('should throw on non-LIST at TOS', () => {
      const vm = createVM();
      push(vm, 5);

      expect(() => dropList(vm)).toThrow('Expected LIST header');
    });
  });

  describe('validateListHeader', () => {
    it('should validate correct LIST header', () => {
      const vm = createVM();
      createList(vm, [42]);

      expect(() => validateListHeader(vm)).not.toThrow();
    });

    it('should throw on empty stack', () => {
      const vm = createVM();

      expect(() => validateListHeader(vm)).toThrow('LIST header validation');
    });

    it('should throw on non-LIST at TOS', () => {
      const vm = createVM();
      push(vm, 5);

      expect(() => validateListHeader(vm)).toThrow('Expected LIST header');
    });

    it('should throw on insufficient payload space', () => {
      const vm = createVM();
      const invalidHeader = Tagged(10, Tag.LIST);
      push(vm, invalidHeader);

      expect(() => validateListHeader(vm)).toThrow('LIST payload validation');
    });

    it('should throw on slot count exceeding maximum', () => {
      const vm = createVM();
      try {
        const invalidHeader = Tagged(65536, Tag.LIST);
        push(vm, invalidHeader);
        expect(() => validateListHeader(vm)).toThrow('exceeds maximum of 65535');
      } catch (e) {
        expect((e as Error).message).toContain('16-bit');
      }
    });
  });

  describe('reverseSpan', () => {
    it('should handle single element (no change)', () => {
      const vm = createVM();
      const value = 42;
      push(vm, value);

      reverseSpan(vm, 1);

      expect(peek(vm)).toBe(value);
    });

    it('should handle zero elements (no change)', () => {
      const vm = createVM();

      expect(() => reverseSpan(vm, 0)).not.toThrow();
    });

    it('should reverse two elements', () => {
      const vm = createVM();
      const val1 = 1;
      const val2 = 2;

      push(vm, val1);
      push(vm, val2);

      reverseSpan(vm, 2);

      expect(peek(vm)).toBe(val1);
      pop(vm);
      expect(peek(vm)).toBe(val2);
    });

    it('should reverse multiple elements', () => {
      const vm = createVM();
      const val1 = 1;
      const val2 = 2;
      const val3 = 3;
      const val4 = 4;

      push(vm, val1);
      push(vm, val2);
      push(vm, val3);
      push(vm, val4);

      reverseSpan(vm, 4);

      expect(pop(vm)).toBe(val1);
      expect(pop(vm)).toBe(val2);
      expect(pop(vm)).toBe(val3);
      expect(pop(vm)).toBe(val4);
    });

    it('should reverse odd number of elements', () => {
      const vm = createVM();
      const val1 = 1;
      const val2 = 2;
      const val3 = 3;

      push(vm, val1);
      push(vm, val2);
      push(vm, val3);

      reverseSpan(vm, 3);

      expect(pop(vm)).toBe(val1);
      expect(pop(vm)).toBe(val2);
      expect(pop(vm)).toBe(val3);
    });

    it('should throw on insufficient stack', () => {
      const vm = createVM();
      push(vm, 1);

      expect(() => reverseSpan(vm, 5)).toThrow('reverse span operation');
    });
  });

  describe('Integration Tests', () => {
    it('should create, validate, and skip LIST in sequence', () => {
      const vm = createVM();
      const values = [10, 20];

      createList(vm, values);
      expect(getStackDepth(vm)).toBe(3);

      validateListHeader(vm);

      dropList(vm);
      expect(getStackDepth(vm)).toBe(0);
    });

    it('should handle nested LIST creation workflow', () => {
      const vm = createVM();

      const innerValues = [1, 2];
      createList(vm, innerValues);
      validateListHeader(vm);

      const innerListValue = pop(vm);
      while (getStackData(vm).length > 0) {
        pop(vm);
      }

      const outerValues = [0, innerListValue, 3];
      createList(vm, outerValues);

      const outerHeader = peek(vm);
      expect(getListLength(outerHeader)).toBe(3);

      validateListHeader(vm);

      dropList(vm);
      expect(getStackDepth(vm)).toBe(0);
    });
  });

  describe('Additional Coverage', () => {
    it('getListElemCell returns -1 for negative index', () => {
      const vm = createVM();
      const header = Tagged(1, Tag.LIST);
      const headerCell = 8;
      expect(getListElemCell(vm, header, headerCell, -1)).toBe(-1);
    });

    it('getListElemCell computes correct cell indices for flat list', () => {
      const vm = createVM();
      const cellHeader = 8;
      const header = Tagged(3, Tag.LIST);
      const e1 = Tagged(11, Tag.NUMBER);
      const e2 = Tagged(22, Tag.NUMBER);
      const e3 = Tagged(33, Tag.NUMBER);

      vm.memory.writeCell(cellHeader - 3, e1);
      vm.memory.writeCell(cellHeader - 2, e2);
      vm.memory.writeCell(cellHeader - 1, e3);
      vm.memory.writeCell(cellHeader, header);

      expect(getListElemCell(vm, header, cellHeader, 0)).toBe(cellHeader - 1);
      expect(getListElemCell(vm, header, cellHeader, 1)).toBe(cellHeader - 2);
      expect(getListElemCell(vm, header, cellHeader, 2)).toBe(cellHeader - 3);
    });

    it('getListBounds returns null for ref pointing to non-list', () => {
      const vm = createVM();
      const cellIndex = 10;
      vm.memory.writeCell(GLOBAL_BASE + cellIndex, 123.456);
      const absCellIndex = GLOBAL_BASE + cellIndex;
      const ref = createRef(absCellIndex);
      expect(getListBounds(vm, ref)).toBeNull();
    });
  });

  describe('Memory Management', () => {
    let vm: VM;

    beforeEach(() => {
      vm = createVM();
    });

    function stackDepth(vm: VM): number {
      return getStackData(vm).length;
    }

    it('creates and drops a large LIST without leaving residual stack data', () => {
      // First verify list creation works
      const stackWithList = executeTacitCode(vm, '( 1 2 3 4 5 6 7 8 9 10 )');
      expect(stackWithList.length).toBe(11); // 10 numbers + 1 list header

      // Now drop it - preserve stack between calls
      const stackAfter = executeTacitCode(vm, 'drop', false);
      expect(stackAfter.length).toBe(0);
      expect(stackDepth(vm)).toBe(0);
    });

    it('handles nested LIST creation and drop in sequence', () => {
      // First verify nested list creation works
      const stackWithList = executeTacitCode(vm, '( 1 ( 2 3 ) 4 )');
      expect(stackWithList.length).toBeGreaterThan(0);

      // Now drop it - preserve stack between calls
      const stackAfter = executeTacitCode(vm, 'drop', false);
      expect(stackAfter.length).toBe(0);
      expect(stackDepth(vm)).toBe(0);
    });
  });
});

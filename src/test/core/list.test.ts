/**
 * @file src/test/core/list.test.ts
 * Tests for LIST core utilities
 */

import { VM, toTaggedValue, Tag, fromTaggedValue, CELL_SIZE } from '../../core';
import { getListLength, dropList, validateListHeader, reverseSpan, isList } from '../../core';
import { createList } from '../utils/core-test-utils';

function resetVM(): VM {
  const vm = new VM();
  vm.reset();
  return vm;
}

function getStackDepth(vm: VM): number {
  return vm.getStackData().length;
}

describe('LIST Core Utilities', () => {
  test('should correctly identify LIST types', () => {
    const list = toTaggedValue(5, Tag.LIST);
    const integer = 5;

    expect(isList(list)).toBe(true);
    expect(isList(integer)).toBe(false);
  });

  test('should handle LIST with zero slot count', () => {
    const emptyList = toTaggedValue(0, Tag.LIST);
    expect(isList(emptyList)).toBe(true);

    const decoded = fromTaggedValue(emptyList);
    expect(decoded.tag).toBe(Tag.LIST);
    expect(decoded.value).toBe(0);
  });

  test('should handle LIST with maximum slot count', () => {
    const maxList = toTaggedValue(65535, Tag.LIST);
    expect(isList(maxList)).toBe(true);

    const decoded = fromTaggedValue(maxList);
    expect(decoded.tag).toBe(Tag.LIST);
    expect(decoded.value).toBe(65535);
  });

  test('should validate LIST value ranges', () => {
    expect(() => toTaggedValue(-1, Tag.LIST)).toThrow();
    expect(() => toTaggedValue(65536, Tag.LIST)).toThrow();
  });

  test('should include LIST in encoded/decoded round-trip tests', () => {
    const tests = [
      { tag: Tag.LIST, value: 0 },
      { tag: Tag.LIST, value: 1 },
      { tag: Tag.LIST, value: 65535 },
    ];

    tests.forEach(({ tag, value }) => {
      const encoded = toTaggedValue(value, tag);
      const decoded = fromTaggedValue(encoded);
      expect(decoded.tag).toBe(tag);
      expect(decoded.value).toBe(value);
      expect(isList(encoded)).toBe(true);
    });
  });

  describe('createList', () => {
    it('should create empty LIST', () => {
      const vm = resetVM();
      createList(vm, []);

      expect(getStackDepth(vm)).toBe(1);
      const header = vm.peek();
      expect(getListLength(header)).toBe(0);
    });

    it('should create LIST with single value', () => {
      const vm = resetVM();
      const value = 42;
      createList(vm, [value]);

      expect(getStackDepth(vm)).toBe(2);
      const header = vm.peek();
      expect(getListLength(header)).toBe(1);

      const payload = vm.memory.readFloat32(0, (vm.SP - 1) * CELL_SIZE);
      expect(isList(payload)).toBe(true);
      expect(getListLength(payload)).toBe(1);
    });

    it('should create LIST with multiple values in reverse order', () => {
      const vm = resetVM();
      const val1 = 1;
      const val2 = 2;
      const val3 = 3;

      createList(vm, [val1, val2, val3]);

      expect(getStackDepth(vm)).toBe(4);
      const header = vm.peek();
      expect(isList(header)).toBe(true);
      expect(getListLength(header)).toBe(3);

      const payload0 = vm.memory.readFloat32(0, (vm.SP - 1) * CELL_SIZE);
      const payload1 = vm.memory.readFloat32(0, (vm.SP - 2) * CELL_SIZE);
      const payload2 = vm.memory.readFloat32(0, (vm.SP - 3) * CELL_SIZE);
      const payload3 = vm.memory.readFloat32(0, (vm.SP - 4) * CELL_SIZE);

      expect(isList(payload0)).toBe(true);
      expect(payload1).toBe(val1);
      expect(payload2).toBe(val2);
      expect(payload3).toBe(val3);
    });

    it('should handle mixed tag types', () => {
      const vm = resetVM();
      const intVal = 42;
      const numVal = 3.14;
      const strVal = toTaggedValue(100, Tag.STRING);

      createList(vm, [intVal, numVal, strVal]);

      expect(getStackDepth(vm)).toBe(4);
      const header = vm.peek();
      expect(getListLength(header)).toBe(3);
    });
  });

  describe('getListSlotCount', () => {
    it('should extract slot count from LIST header', () => {
      const header = toTaggedValue(5, Tag.LIST);
      expect(getListLength(header)).toBe(5);
    });

    it('should handle zero slot count', () => {
      const header = toTaggedValue(0, Tag.LIST);
      expect(getListLength(header)).toBe(0);
    });

    it('should handle maximum slot count', () => {
      const header = toTaggedValue(65535, Tag.LIST);
      expect(getListLength(header)).toBe(65535);
    });

    it('should throw on non-LIST header', () => {
      const nonList = toTaggedValue(5, Tag.STRING);
      expect(() => getListLength(nonList)).toThrow('Value is not an LIST header');
    });
  });

  describe('dropList', () => {
    it('should skip empty LIST', () => {
      const vm = resetVM();
      createList(vm, []);

      const initialSP = vm.SP;
      dropList(vm);
      const finalSP = vm.SP;

      expect(initialSP - finalSP).toBe(1);
      expect(getStackDepth(vm)).toBe(0);
    });

    it('should skip LIST with single value', () => {
      const vm = resetVM();
      const value = 42;
      createList(vm, [value]);

      const initialSP = vm.SP;
      dropList(vm);
      const finalSP = vm.SP;

      expect(initialSP - finalSP).toBe(2);
      expect(getStackDepth(vm)).toBe(0);
    });

    it('should skip LIST with multiple values', () => {
      const vm = resetVM();
      const values = [1, 2, 3];
      createList(vm, values);

      const initialSP = vm.SP;
      dropList(vm);
      const finalSP = vm.SP;

      expect(initialSP - finalSP).toBe(4);
      expect(getStackDepth(vm)).toBe(0);
    });

    it('should throw on non-LIST at TOS', () => {
      const vm = resetVM();
      vm.push(5);

      expect(() => dropList(vm)).toThrow('Expected LIST header at TOS');
    });
  });

  describe('validateListHeader', () => {
    it('should validate correct LIST header', () => {
      const vm = resetVM();
      createList(vm, [42]);

      expect(() => validateListHeader(vm)).not.toThrow();
    });

    it('should throw on empty stack', () => {
      const vm = resetVM();

      expect(() => validateListHeader(vm)).toThrow('LIST header validation');
    });

    it('should throw on non-LIST at TOS', () => {
      const vm = resetVM();
      vm.push(5);

      expect(() => validateListHeader(vm)).toThrow('Expected LIST header at TOS');
    });

    it('should throw on insufficient payload space', () => {
      const vm = resetVM();
      const invalidHeader = toTaggedValue(10, Tag.LIST);
      vm.push(invalidHeader);

      expect(() => validateListHeader(vm)).toThrow('LIST payload validation');
    });

    it('should throw on slot count exceeding maximum', () => {
      const vm = resetVM();
      try {
        const invalidHeader = toTaggedValue(65536, Tag.LIST);
        vm.push(invalidHeader);
        expect(() => validateListHeader(vm)).toThrow('exceeds maximum of 65535');
      } catch (e) {
        expect((e as Error).message).toContain('16-bit');
      }
    });
  });

  describe('reverseSpan', () => {
    it('should handle single element (no change)', () => {
      const vm = resetVM();
      const value = 42;
      vm.push(value);

      reverseSpan(vm, 1);

      expect(vm.peek()).toBe(value);
    });

    it('should handle zero elements (no change)', () => {
      const vm = resetVM();

      expect(() => reverseSpan(vm, 0)).not.toThrow();
    });

    it('should reverse two elements', () => {
      const vm = resetVM();
      const val1 = 1;
      const val2 = 2;

      vm.push(val1);
      vm.push(val2);

      reverseSpan(vm, 2);

      expect(vm.peek()).toBe(val1);
      vm.pop();
      expect(vm.peek()).toBe(val2);
    });

    it('should reverse multiple elements', () => {
      const vm = resetVM();
      const val1 = 1;
      const val2 = 2;
      const val3 = 3;
      const val4 = 4;

      vm.push(val1);
      vm.push(val2);
      vm.push(val3);
      vm.push(val4);

      reverseSpan(vm, 4);

      expect(vm.pop()).toBe(val1);
      expect(vm.pop()).toBe(val2);
      expect(vm.pop()).toBe(val3);
      expect(vm.pop()).toBe(val4);
    });

    it('should reverse odd number of elements', () => {
      const vm = resetVM();
      const val1 = 1;
      const val2 = 2;
      const val3 = 3;

      vm.push(val1);
      vm.push(val2);
      vm.push(val3);

      reverseSpan(vm, 3);

      expect(vm.pop()).toBe(val1);
      expect(vm.pop()).toBe(val2);
      expect(vm.pop()).toBe(val3);
    });

    it('should throw on insufficient stack', () => {
      const vm = resetVM();
      vm.push(1);

      expect(() => reverseSpan(vm, 5)).toThrow('reverse span operation');
    });
  });

  describe('Integration Tests', () => {
    it('should create, validate, and skip LIST in sequence', () => {
      const vm = resetVM();
      const values = [10, 20];

      createList(vm, values);
      expect(getStackDepth(vm)).toBe(3);

      validateListHeader(vm);

      dropList(vm);
      expect(getStackDepth(vm)).toBe(0);
    });

    it('should handle nested LIST creation workflow', () => {
      const vm = resetVM();

      const innerValues = [1, 2];
      createList(vm, innerValues);
      validateListHeader(vm);

      const innerListValue = vm.pop();
      while (vm.getStackData().length > 0) {
        vm.pop();
      }

      const outerValues = [0, innerListValue, 3];
      createList(vm, outerValues);

      const outerHeader = vm.peek();
      expect(getListLength(outerHeader)).toBe(3);

      validateListHeader(vm);

      dropList(vm);
      expect(getStackDepth(vm)).toBe(0);
    });
  });
});

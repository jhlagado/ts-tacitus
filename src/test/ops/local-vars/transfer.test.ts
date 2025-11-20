import { describe, test, expect, beforeEach } from '@jest/globals';
import { createVM, type VM, rdepth, depth, getStackData } from '../../../core/vm';
import { rpushList, loadListFromReturn } from '../../../ops/local-vars-transfer';
import { pushListLiteral } from '../../utils/vm-test-utils';
import { memoryReadCell, memoryWriteCell } from '../../../core';
import { RSTACK_BASE } from '../../../core/constants';
import { getTaggedInfo, Tag, Tagged } from '../../../core/tagged';

describe('Local Variable Transfer Ops', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM();
    vm.debug = false;
  });

  describe('rpushList', () => {
    test('transfers multi-element lists to the return stack', () => {
      pushListLiteral(vm, 10, 20, 30);

      const headerCell = rpushList(vm);

      expect(depth(vm)).toBe(0);
      expect(headerCell).toBe(rdepth(vm) - 1);

      const headerAddr = RSTACK_BASE + headerCell;
      const header = memoryReadCell(vm.memory, headerAddr);
      const { tag, value: slotCount } = getTaggedInfo(header);
      expect(tag).toBe(Tag.LIST);
      expect(slotCount).toBe(3);

      const payload = [];
      for (let i = 0; i < slotCount; i++) {
        payload.push(memoryReadCell(vm.memory, RSTACK_BASE + i));
      }
      expect(payload).toEqual([10, 20, 30]);
    });

    test('handles empty lists via the fast path', () => {
      pushListLiteral(vm);

      const headerCell = rpushList(vm);

      expect(depth(vm)).toBe(0);
      expect(rdepth(vm)).toBe(1);

      const header = memoryReadCell(vm.memory, RSTACK_BASE + headerCell);
      const { tag, value } = getTaggedInfo(header);
      expect(tag).toBe(Tag.LIST);
      expect(value).toBe(0);
    });
  });

  describe('loadListFromReturn', () => {
    test('materializes list back onto the data stack', () => {
      pushListLiteral(vm, 5, 6);
      const headerCell = rpushList(vm);

      loadListFromReturn(vm, headerCell);

      const stack = getStackData(vm);
      const { tag, value } = getTaggedInfo(stack[stack.length - 1]);
      expect(tag).toBe(Tag.LIST);
      expect(value).toBe(2);
      expect(stack.slice(0, 2)).toEqual([5, 6]);
    });

    test('returns header only for empty lists', () => {
      pushListLiteral(vm);
      const headerCell = rpushList(vm);

      loadListFromReturn(vm, headerCell);

      expect(getStackData(vm)).toHaveLength(1);
      const { tag, value } = getTaggedInfo(getStackData(vm)[0]);
      expect(tag).toBe(Tag.LIST);
      expect(value).toBe(0);
    });

    test('throws when the header cell does not contain a list', () => {
      const headerCell = 0;
      memoryWriteCell(vm.memory, RSTACK_BASE + headerCell, Tagged(1, Tag.STRING));

      expect(() => loadListFromReturn(vm, headerCell)).toThrow('Expected LIST header');
    });
  });
});

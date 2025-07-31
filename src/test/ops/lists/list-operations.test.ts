/**
 * Tests for list manipulation operations - Extracted from stack operation test files
 * Focuses on how list-aware stack operations handle lists differently from simple values
 */
import { describe, test, expect, beforeEach } from '@jest/globals';
import { fromTaggedValue, Tag, toTaggedValue } from '../../../core/tagged';
import { vm } from '../../../core/globalState';
import { executeTacitCode, resetVM } from '../../utils/test-utils';
import { dupOp } from '../../../ops/builtins-stack';
import { swapOp } from '../../../ops/builtins-stack';
import { dropOp } from '../../../ops/builtins-stack';
import { rotOp } from '../../../ops/builtins-stack';
import { revrotOp } from '../../../ops/builtins-stack';
import { overOp } from '../../../ops/builtins-stack';
import { tuckOp } from '../../../ops/builtins-stack';
import { nipOp } from '../../../ops/builtins-stack';
import { pickOp } from '../../../ops/builtins-stack';

describe('List Operations', () => {
  beforeEach(() => {
    resetVM();
  });

  describe('simple values', () => {
    test('should duplicate a simple list', () => {
      const listTag = toTaggedValue(2, Tag.LIST);
      const linkTag = toTaggedValue(3, Tag.LINK);

      vm.push(listTag);
      vm.push(1);
      vm.push(2);
      vm.push(linkTag);

      dupOp(vm);

      const stack = vm.getStackData();
      expect(stack.length).toBe(8);

      expect(stack[0]).toEqual(listTag);
      expect(stack[1]).toBe(1);
      expect(stack[2]).toBe(2);
      expect(stack[3]).toEqual(linkTag);

      expect(stack[4]).toEqual(listTag);
      expect(stack[5]).toBe(1);
      expect(stack[6]).toBe(2);
      expect(stack[7]).toEqual(linkTag);
    });

    test('should swap a simple list with a value', () => {
      vm.push(5);

      const listTag = toTaggedValue(2, Tag.LIST);
      const linkTag = toTaggedValue(3, Tag.LINK);
      vm.push(listTag);
      vm.push(20);
      vm.push(30);
      vm.push(linkTag);

      vm.push(10);

      swapOp(vm);

      const stack = vm.getStackData();
      expect(stack.length).toBe(6);
    });

    test('should drop an entire simple list', () => {
      const listTag = toTaggedValue(2, Tag.LIST);
      const linkTag = toTaggedValue(3, Tag.LINK);

      vm.push(listTag);
      vm.push(10);
      vm.push(20);
      vm.push(linkTag);

      dropOp(vm);

      const stack = vm.getStackData();
      expect(stack.length).toBe(0);
    });
  });

  describe('list operations', () => {
    test('should duplicate simple value under a list', () => {
      const stack = executeTacitCode('( 10 20 ) 42 tuck');

      expect(stack[0]).toBe(42);
      expect(stack).toContain(10);
      expect(stack).toContain(20);
      expect(stack[stack.length - 1]).toBe(42);
    });

    test('should duplicate list under simple value', () => {
      const stack = executeTacitCode('42 ( 99 88 ) tuck');

      expect(stack).toContain(99);
      expect(stack).toContain(88);
      expect(stack).toContain(42);

      expect(stack.filter(x => x === 99).length).toBe(2);
      expect(stack.filter(x => x === 88).length).toBe(2);
    });

    test('should remove list under another list', () => {
      const stack = executeTacitCode('( 100 200 ) ( 300 400 ) nip');

      expect(stack).not.toContain(100);
      expect(stack).not.toContain(200);
      expect(stack).toContain(300);
      expect(stack).toContain(400);
    });

    test('should handle multi-element lists', () => {
      const stack = executeTacitCode('( 10 20 30 40 ) 999 nip');

      expect(stack).toEqual([999]);
    });

    test('should swap two simple lists', () => {
      vm.push(5);

      const listTag1 = toTaggedValue(2, Tag.LIST);
      const linkTag1 = toTaggedValue(3, Tag.LINK);
      vm.push(listTag1);
      vm.push(10);
      vm.push(20);
      vm.push(linkTag1);

      const listTag2 = toTaggedValue(2, Tag.LIST);
      const linkTag2 = toTaggedValue(3, Tag.LINK);
      vm.push(listTag2);
      vm.push(30);
      vm.push(40);
      vm.push(linkTag2);

      swapOp(vm);

      const stack = vm.getStackData();
      expect(stack.length).toBe(9);

      expect(stack[0]).toBe(5);

      const swappedListTag1 = fromTaggedValue(stack[5]);
      expect(swappedListTag1.tag).toBe(Tag.LIST);
      expect(swappedListTag1.value).toBe(2);
      expect(stack[6]).toBe(10);
      expect(stack[7]).toBe(20);

      const swappedLinkTag1 = fromTaggedValue(stack[8]);
      expect(swappedLinkTag1.tag).toBe(Tag.LINK);
      expect(swappedLinkTag1.value).toBe(3);
    });

    test('should rotate a list with two simple values', () => {
      const listTag = toTaggedValue(2, Tag.LIST);
      const linkTag = toTaggedValue(3, Tag.LINK);
      vm.push(listTag);
      vm.push(1);
      vm.push(2);
      vm.push(linkTag);

      vm.push(3);
      vm.push(4);

      rotOp(vm);

      const stack = vm.getStackData();
      expect(stack.length).toBe(6);
    });

    test('should pick a list from the stack', () => {
      const listTag = toTaggedValue(2, Tag.LIST);
      const linkTag = toTaggedValue(3, Tag.LINK);
      vm.push(listTag);
      vm.push(10);
      vm.push(20);
      vm.push(linkTag);

      vm.push(5);

      vm.push(1);

      pickOp(vm);

      const stack = vm.getStackData();

      expect(stack.length).toBeGreaterThanOrEqual(6);
    });
  });

  describe('error cases', () => {
    test('should handle empty lists during swap', () => {
      vm.push(5);
      vm.push(42);

      const listTag = toTaggedValue(0, Tag.LIST);
      const linkTag = toTaggedValue(1, Tag.LINK);
      vm.push(listTag);
      vm.push(linkTag);

      swapOp(vm);

      const stack = vm.getStackData();
      expect(stack.length).toBe(4);
      expect(stack[0]).toBe(5);

      const swappedListTag = fromTaggedValue(stack[1]);
      expect(swappedListTag.tag).toBe(Tag.LIST);
      expect(swappedListTag.value).toBe(0);

      const swappedLinkTag = fromTaggedValue(stack[2]);
      expect(swappedLinkTag.tag).toBe(Tag.LINK);

      expect(stack[3]).toBe(42);
    });

    test('should drop a list while leaving other values on stack', () => {
      vm.push(5);

      const listTag = toTaggedValue(2, Tag.LIST);
      const linkTag = toTaggedValue(3, Tag.LINK);
      vm.push(listTag);
      vm.push(1);
      vm.push(2);
      vm.push(linkTag);

      dropOp(vm);

      const stack = vm.getStackData();
      expect(stack.length).toBe(1);
      expect(stack[0]).toBe(5);
    });
  });

  describe('integration tests', () => {
    test('should duplicate a nested list', () => {
      const innerListTag = toTaggedValue(2, Tag.LIST);
      const innerLinkTag = toTaggedValue(3, Tag.LINK);
      const outerListTag = toTaggedValue(3, Tag.LIST);
      const outerLinkTag = toTaggedValue(6, Tag.LINK);

      vm.push(outerListTag);
      vm.push(1);
      vm.push(innerListTag);
      vm.push(2);
      vm.push(3);
      vm.push(innerLinkTag);
      vm.push(4);
      vm.push(outerLinkTag);

      const stackBeforeDup = vm.getStackData();

      dupOp(vm);

      const dupStack = vm.getStackData();

      expect(dupStack.length).toBeGreaterThan(stackBeforeDup.length);
    });

    test('should handle nested lists correctly during operations', () => {
      const stack = executeTacitCode('123 ( 1 ( 2 3 ) 4 ) nip');

      expect(stack.length).toBeGreaterThan(0);
      expect(stack).not.toContain(123);
    });

    test('should drop a nested list completely', () => {
      const innerListTag = toTaggedValue(2, Tag.LIST);
      const outerListTag = toTaggedValue(3, Tag.LIST);
      const outerLinkTag = toTaggedValue(6, Tag.LINK);

      vm.push(outerListTag);
      vm.push(1);
      vm.push(innerListTag);
      vm.push(2);
      vm.push(3);
      vm.push(4);
      vm.push(outerLinkTag);

      const stackBeforeLength = vm.getStackData().length;
      expect(stackBeforeLength).toBeGreaterThan(0);

      dropOp(vm);

      const stackAfter = vm.getStackData();
      expect(stackAfter.length).toBe(0);
    });

    test('should handle complex list interactions', () => {
      const stack = executeTacitCode('( 1 ( 2 3 ) 4 ) 123 tuck');

      expect(stack.length).toBeGreaterThan(6);
      expect(stack).toContain(123);
      expect(stack).toContain(1);
      expect(stack).toContain(2);
      expect(stack).toContain(3);
      expect(stack).toContain(4);
    });
  });
});

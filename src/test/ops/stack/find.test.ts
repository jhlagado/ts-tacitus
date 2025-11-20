import { describe, test, expect, beforeEach } from '@jest/globals';
import { VM, Tag, createVM } from '../../../core';
import { STACK_BASE } from '../../../core/constants';
import { findElement } from '../../../ops/stack';
import { pushNumber, pushListLiteral, pushTaggedValue } from '../../utils/vm-test-utils';

describe('findElement', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM();
  });

  test('should find a simple list', () => {
    pushListLiteral(vm, 1, 2);
    const [_nextSlot, size] = findElement(vm, 0);
    expect(size).toBe(3);
  });

  test('should return size 1 for non-list', () => {
    pushNumber(vm, 42);
    pushNumber(vm, 13);

    const [_, size] = findElement(vm, 0);
    expect(size).toBe(1);
  });

  test('should find nested lists', () => {
    pushListLiteral(vm, 1, 2);
    const [_innerNext, innerSize] = findElement(vm, 0);
    expect(innerSize).toBe(3);

    pushNumber(vm, 4);
    pushTaggedValue(vm, 3, Tag.LIST);

    const [_outerNext, outerSize] = findElement(vm, 0);
    expect(outerSize).toBe(4);
  });

  test('should return size 1 when stack is empty', () => {
    const [_, size] = findElement(vm, 0);
    expect(size).toBe(1);
  });

  test('should return size 1 when element is not a list', () => {
    pushNumber(vm, 42);

    const [_, size] = findElement(vm, 0);
    expect(size).toBe(1);
  });

  test('should find a list with offset from the top', () => {
    pushListLiteral(vm, 1, 2);
    pushNumber(vm, 10);
    pushNumber(vm, 20);

    const [offset1, size1] = findElement(vm, 0);
    expect(size1).toBe(1);

    const [offset2, size2] = findElement(vm, offset1);
    expect(size2).toBe(1);

    const [_next, size] = findElement(vm, offset2);
    expect(size).toBe(3);
  });

  test('should find an empty list', () => {
    pushTaggedValue(vm, 0, Tag.LIST);
    const [_next, size] = findElement(vm, 0);
    expect(size).toBe(1);
  });

  test('should return size 1 for invalid list structure (missing LIST tag)', () => {
    pushNumber(vm, 1);
    const [_next, size] = findElement(vm, 0);
    expect(size).toBe(1);
  });

  test('should return size 1 for invalid list structure (size mismatch)', () => {
    pushNumber(vm, 2);
    pushNumber(vm, 1);
    const [_next, size] = findElement(vm, 0);
    expect(size).toBe(1);
  });

  test('should handle out of bounds access', () => {
    vm.sp = STACK_BASE;
    const [_next1, size1] = findElement(vm, 0);
    expect(size1).toBe(1);

    const [_next2, size2] = findElement(vm, -1);
    expect(size2).toBe(1);

    const largeOffset = 1000000;
    const [_next3, size3] = findElement(vm, largeOffset);
    expect(size3).toBe(1);
  });

  test('should find list after pushing other values', () => {
    pushListLiteral(vm, 42, 100);
    pushNumber(vm, 500);
    pushNumber(vm, 600);

    const [offset1, size1] = findElement(vm, 0);
    expect(size1).toBe(1);

    const [offset2, size2] = findElement(vm, offset1);
    expect(size2).toBe(1);

    const [_next, size] = findElement(vm, offset2);
    expect(size).toBe(3);
  });

  test('should handle maximum size list within limits', () => {
    const maxSize = 10;
    for (let i = 0; i < maxSize; i++) {
      pushNumber(vm, i % 1000);
    }
    pushTaggedValue(vm, maxSize, Tag.LIST);

    const [_next, size] = findElement(vm, 0);
    expect(size).toBe(maxSize + 1);
  });
});

describe('findElement', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM();
  });

  test('should find elements in sequence', () => {
    pushListLiteral(vm, 1, 2);
    pushNumber(vm, 42);
    pushNumber(vm, 43);

    const [offset1, size1] = findElement(vm, 0);
    expect(offset1).toBe(1);
    expect(size1).toBe(1);

    const [offset2, size2] = findElement(vm, offset1);
    expect(offset2).toBe(2);
    expect(size2).toBe(1);

    const [offset3, size3] = findElement(vm, offset2);
    expect(offset3).toBe(5);
    expect(size3).toBe(3);
  });

  test('should handle list at TOS', () => {
    pushListLiteral(vm, 1, 2);

    const [nextSlot, size] = findElement(vm, 0);
    expect(size).toBe(3);
    expect(nextSlot).toBe(3);
  });

  test('should handle multiple lists', () => {
    pushListLiteral(vm, 3, 4);
    pushListLiteral(vm, 1);

    const [offset1, size1] = findElement(vm, 0);
    expect(size1).toBe(2);

    const [_offset2, size2] = findElement(vm, offset1);
    expect(size2).toBe(3);
  });
});

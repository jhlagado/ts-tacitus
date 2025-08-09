import { describe, test, expect, beforeEach } from '@jest/globals';
import { VM } from '../../core/vm';
import { SEG_STACK } from '../../core/constants';
import { toTaggedValue, Tag } from '../../core/tagged';
import { findElement } from '../../stack/find';

function pushValue(vm: VM, value: number, tag: Tag = Tag.NUMBER): void {
  vm.memory.writeFloat32(SEG_STACK, vm.SP, toTaggedValue(value, tag));
  vm.SP += 4;
}

function createRList(vm: VM, ...values: number[]): { start: number; end: number } {
  const start = vm.SP;
  values.forEach(val => pushValue(vm, val));
  pushValue(vm, values.length, Tag.LIST);
  return { start, end: vm.SP };
}

describe('findElement', () => {
  let vm: VM;

  beforeEach(() => {
    vm = new VM();
  });

  test('should find a simple list', () => {
    createRList(vm, 1, 2);
    const [_nextSlot, size] = findElement(vm, 0);
    expect(size).toBe(3);
  });

  test('should return size 1 for non-list', () => {
    pushValue(vm, 42);
    pushValue(vm, 13);

    const [_, size] = findElement(vm, 0);
    expect(size).toBe(1);
  });

  test('should find nested lists', () => {
    // Inner (2): 2 payload + header
    createRList(vm, 1, 2);
    const [_innerNext, innerSize] = findElement(vm, 0);
    expect(innerSize).toBe(3);

    // Wrap inner within outer: push inner payload+header remains contiguous; then add outer header
    pushValue(vm, 4); // another payload under inner header
    pushValue(vm, 3, Tag.LIST); // outer header with 3 slots total for payload (inner header counts as one slot)

    const [_outerNext, outerSize] = findElement(vm, 0);
    expect(outerSize).toBe(4);
  });

  test('should return size 1 when stack is empty', () => {
    const [_, size] = findElement(vm, 0);
    expect(size).toBe(1);
  });

  test('should return size 1 when element is not a list', () => {
    pushValue(vm, 42);

    const [_, size] = findElement(vm, 0);
    expect(size).toBe(1);
  });

  test('should find a list with offset from the top', () => {
    createRList(vm, 1, 2);
    pushValue(vm, 10);
    pushValue(vm, 20);

    const [offset1, size1] = findElement(vm, 0);
    expect(size1).toBe(1);

    const [offset2, size2] = findElement(vm, offset1);
    expect(size2).toBe(1);

    const [_next, size] = findElement(vm, offset2);
    expect(size).toBe(3);
  });

  test('should find an empty list', () => {
    pushValue(vm, 0, Tag.LIST);
    const [_next, size] = findElement(vm, 0);
    expect(size).toBe(1);
  });

  test('should return size 1 for invalid list structure (missing LIST tag)', () => {
    // Legacy scenario removed; LIST must have header tag
    pushValue(vm, 1, Tag.NUMBER);
    const [_next, size] = findElement(vm, 0);
    expect(size).toBe(1);
  });

  test('should return size 1 for invalid list structure (size mismatch)', () => {
    // Invalid LIST-like sequence (no header or wrong tag): treated as atomic
    pushValue(vm, 2);
    pushValue(vm, 1);
    const [_next, size] = findElement(vm, 0);
    expect(size).toBe(1);
  });

  test('should handle out of bounds access', () => {
    vm.SP = 0;
    const [_next1, size1] = findElement(vm, 0);
    expect(size1).toBe(1);

    const [_next2, size2] = findElement(vm, -1);
    expect(size2).toBe(1);

    const largeOffset = 1000000;
    const [_next3, size3] = findElement(vm, largeOffset);
    expect(size3).toBe(1);
  });

  test('should find list after pushing other values', () => {
    createRList(vm, 42, 100);
    pushValue(vm, 500);
    pushValue(vm, 600);

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
      pushValue(vm, i % 1000);
    }
    pushValue(vm, maxSize, Tag.LIST);

    const [_next, size] = findElement(vm, 0);
    expect(size).toBe(maxSize + 1);
  });
});

describe('findElement', () => {
  let vm: VM;

  beforeEach(() => {
    vm = new VM();
  });

  test('should find elements in sequence', () => {
    createRList(vm, 1, 2);
    pushValue(vm, 42);
    pushValue(vm, 43);

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
    createRList(vm, 1, 2);

    const [nextSlot, size] = findElement(vm, 0);
    expect(size).toBe(3);
    expect(nextSlot).toBe(3);
  });

  test('should handle multiple lists', () => {
    createRList(vm, 3, 4);
    createRList(vm, 1);

    const [offset1, size1] = findElement(vm, 0);
    expect(size1).toBe(2);

    const [_offset2, size2] = findElement(vm, offset1);
    expect(size2).toBe(3);
  });
});

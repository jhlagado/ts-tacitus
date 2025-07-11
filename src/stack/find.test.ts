import { describe, test, expect, beforeEach } from '@jest/globals';
import { VM } from '../core/vm';
import { SEG_STACK } from '../core/memory';
import { toTaggedValue, Tag } from '../core/tagged';
import { findElement } from './find';

function pushValue(vm: VM, value: number, tag: Tag = Tag.NUMBER): void {
  vm.memory.writeFloat32(SEG_STACK, vm.SP, toTaggedValue(value, tag));
  vm.SP += 4;
}

function createSimpleTuple(vm: VM, ...values: number[]): { start: number; end: number } {
  const start = vm.SP;

  pushValue(vm, values.length, Tag.TUPLE);

  values.forEach(val => pushValue(vm, val));

  pushValue(vm, values.length + 1, Tag.LINK);

  return {
    start,
    end: vm.SP,
  };
}

describe('findElement', () => {
  let vm: VM;

  beforeEach(() => {
    vm = new VM();
  });

  test('should find a simple tuple', () => {
    createSimpleTuple(vm, 1, 2);

    const [_nextSlot, size] = findElement(vm, 0);

    expect(size).toBe(4);
  });

  test('should return size 1 for non-tuple', () => {
    pushValue(vm, 42);
    pushValue(vm, 13);

    const [_, size] = findElement(vm, 0);
    expect(size).toBe(1);
  });

  test('should find nested tuples', () => {
    createSimpleTuple(vm, 1, 2);

    const [_innerNext, innerSize] = findElement(vm, 0);
    expect(innerSize).toBe(4);

    pushValue(vm, 1, Tag.TUPLE);
    pushValue(vm, 4);
    pushValue(vm, 2, Tag.LINK);

    const [_outerNext, outerSize] = findElement(vm, 0);
    expect(outerSize).toBe(3);
  });

  test('should return size 1 when stack is empty', () => {
    const [_, size] = findElement(vm, 0);
    expect(size).toBe(1);
  });

  test('should return size 1 when element is not a tuple', () => {
    pushValue(vm, 42);

    const [_, size] = findElement(vm, 0);
    expect(size).toBe(1);
  });

  test('should find a tuple with offset from the top', () => {
    createSimpleTuple(vm, 1, 2);

    pushValue(vm, 10);
    pushValue(vm, 20);

    const [offset1, size1] = findElement(vm, 0);
    expect(size1).toBe(1);

    const [offset2, size2] = findElement(vm, offset1);
    expect(size2).toBe(1);

    const [_next, size] = findElement(vm, offset2);

    expect(size).toBe(4);
  });

  test('should find an empty tuple', () => {
    pushValue(vm, 0, Tag.TUPLE);
    pushValue(vm, 1, Tag.LINK);

    const [_next, size] = findElement(vm, 0);
    expect(size).toBe(2);
  });

  test('should return size 1 for invalid tuple structure (missing TUPLE tag)', () => {
    pushValue(vm, 1, Tag.LINK);

    const [_next, size] = findElement(vm, 0);
    expect(size).toBe(1);
  });

  test('should return size 1 for invalid tuple structure (size mismatch)', () => {
    pushValue(vm, 2, Tag.TUPLE);
    pushValue(vm, 1);
    pushValue(vm, 2);
    pushValue(vm, 4, Tag.LINK);

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

  test('should find tuple after pushing other values', () => {
    createSimpleTuple(vm, 42, 100);

    pushValue(vm, 500);
    pushValue(vm, 600);

    const [offset1, size1] = findElement(vm, 0);
    expect(size1).toBe(1);

    const [offset2, size2] = findElement(vm, offset1);
    expect(size2).toBe(1);

    const [_next, size] = findElement(vm, offset2);

    expect(size).toBe(4);
  });

  test('should handle maximum size tuple within limits', () => {
    const maxSize = 10;

    pushValue(vm, maxSize, Tag.TUPLE);

    for (let i = 0; i < maxSize; i++) {
      pushValue(vm, i % 1000);
    }

    pushValue(vm, maxSize + 1, Tag.LINK);

    const [_next, size] = findElement(vm, 0);
    expect(size).toBe(maxSize + 2);
  });
});

describe('findElement', () => {
  let vm: VM;

  beforeEach(() => {
    vm = new VM();
  });

  test('should find elements in sequence', () => {
    createSimpleTuple(vm, 1, 2);
    pushValue(vm, 42);
    pushValue(vm, 43);

    const [offset1, size1] = findElement(vm, 0);
    expect(offset1).toBe(1);
    expect(size1).toBe(1);

    const [offset2, size2] = findElement(vm, offset1);
    expect(offset2).toBe(2);
    expect(size2).toBe(1);

    const [offset3, size3] = findElement(vm, offset2);
    expect(offset3).toBe(6);
    expect(size3).toBe(4);
  });

  test('should handle tuple at TOS', () => {
    createSimpleTuple(vm, 1, 2);

    const [nextSlot, size] = findElement(vm, 0);
    expect(size).toBe(4);
    expect(nextSlot).toBe(4);
  });

  test('should handle multiple tuples', () => {
    createSimpleTuple(vm, 3, 4);
    createSimpleTuple(vm, 1);

    const [offset1, size1] = findElement(vm, 0);
    expect(size1).toBe(3);

    const [_offset2, size2] = findElement(vm, offset1);
    expect(size2).toBe(4);
  });
});

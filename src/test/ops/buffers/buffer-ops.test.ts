/**
 * @file src/test/ops/buffers/buffer-ops.test.ts
 * Tests for ring buffer operations.
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import {
  createVM,
  VM,
  Tag,
  getTaggedInfo,
  getListLength,
  getListBounds,
  isList,
} from '../../../core';
import { executeTacitCode, testTacitCode } from '../../utils/vm-test-utils';
import { STACK_BASE } from '../../../core/constants';

describe('Buffer Operations', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM();
  });

  describe('buffer (creation)', () => {
    test('creates buffer with valid capacity', () => {
      executeTacitCode(vm, '10 buffer');
      // LIST header is at TOS, payload slots are below it
      const header = vm.memory.readCell(vm.sp - 1);
      const { tag, value } = getTaggedInfo(header);
      expect(tag).toBe(Tag.LIST);
      expect(value).toBe(12); // N+2 = 10+2 = 12 payload slots
      // Verify total slots: header + payload = 1 + 12 = 13
      expect(vm.sp - STACK_BASE).toBe(13);
    });

    test('initializes pointers to 0', () => {
      executeTacitCode(vm, '5 buffer');
      const headerCell = vm.sp - 1;
      const readPtr = vm.memory.readCell(headerCell - 1);
      const writePtr = vm.memory.readCell(headerCell - 2);
      expect(readPtr).toBe(0);
      expect(writePtr).toBe(0);
    });

    test('throws error for capacity < 1', () => {
      expect(() => executeTacitCode(vm, '0 buffer')).toThrow('capacity must be >= 1');
      expect(() => executeTacitCode(vm, '-1 buffer')).toThrow('capacity must be >= 1');
    });

    test('creates buffer with capacity 1', () => {
      executeTacitCode(vm, '1 buffer');
      const header = vm.memory.readCell(vm.sp - 1);
      const { tag, value } = getTaggedInfo(header);
      expect(tag).toBe(Tag.LIST);
      expect(value).toBe(3); // N+2 = 1+2 = 3 payload slots
      expect(vm.sp - STACK_BASE).toBe(4); // header + 3 payload slots
    });

    test('creates buffer with large capacity', () => {
      executeTacitCode(vm, '100 buffer');
      const header = vm.memory.readCell(vm.sp - 1);
      const { tag, value } = getTaggedInfo(header);
      expect(tag).toBe(Tag.LIST);
      expect(value).toBe(102); // N+2 = 100+2 = 102 payload slots
      expect(vm.sp - STACK_BASE).toBe(103); // header + 102 payload slots
    });
  });

  describe('buf-size', () => {
    test('returns 0 for empty buffer', () => {
      testTacitCode(vm, '10 buffer buf-size', [0]);
    });

    test('returns correct size after writes', () => {
      // Test the full sequence: 42 &buf write
      // The error shows stack [42] when write executes, meaning &buf didn't push
      // Let's add debug to writeOp to see what it receives
      testTacitCode(vm, ': f 10 buffer var buf 42 &buf write &buf buf-size ; f', [1]);
    });

    test('returns correct size after wrap-around', () => {
      const code = `
        : f
          5 buffer var buf
          1 &buf write 2 &buf write 3 &buf write 4 &buf write 5 &buf write
          &buf buf-size
        ;
        f
      `;
      testTacitCode(vm, code, [5]);
    });

    test('works with direct LIST header', () => {
      const code = `
        : f
          5 buffer
          dup
          42 swap write
          swap drop
          buf-size
        ;
        f
      `;
      testTacitCode(vm, code, [1]);
    });
  });

  describe('is-empty', () => {
    test('returns 1 for empty buffer', () => {
      testTacitCode(vm, '10 buffer is-empty', [1]);
    });

    test('returns 0 for non-empty buffer', () => {
      testTacitCode(vm, ': f 10 buffer var buf 42 &buf write &buf is-empty ; f', [0]);
    });

    test('returns 1 after all elements are read', () => {
      const code = `
        : f
          5 buffer var buf
          42 &buf write
          &buf read drop
          &buf is-empty
        ;
        f
      `;
      testTacitCode(vm, code, [1]);
    });
  });

  describe('is-full', () => {
    test('returns 0 for empty buffer', () => {
      testTacitCode(vm, '10 buffer is-full', [0]);
    });

    test('returns 0 for partially full buffer', () => {
      const code = `
        : f
          10 buffer var buf
          42 &buf write
          &buf is-full
        ;
        f
      `;
      testTacitCode(vm, code, [0]);
    });

    test('returns 1 for full buffer', () => {
      const code = `
        : f
          5 buffer var buf
          1 &buf write 2 &buf write 3 &buf write 4 &buf write 5 &buf write
          &buf is-full
        ;
        f
      `;
      testTacitCode(vm, code, [1]);
    });
  });

  describe('write (stack operation)', () => {
    test('writes value to empty buffer', () => {
      const code = `
        : f
          10 buffer var buf
          42 &buf write
          &buf buf-size
        ;
        f
      `;
      testTacitCode(vm, code, [1]);
    });

    test('writes multiple values', () => {
      const code = `
        : f
          10 buffer var buf
          42 &buf write
          43 &buf write
          44 &buf write
          &buf buf-size
        ;
        f
      `;
      testTacitCode(vm, code, [3]);
    });

    test('throws error on overflow', () => {
      const code = `
        : f
          5 buffer var buf
          1 &buf write
          2 &buf write
          3 &buf write
          4 &buf write
          5 &buf write
          6 &buf write
        ;
        f
      `;
      expect(() => executeTacitCode(vm, code)).toThrow('Buffer overflow');
    });

    test('supports wrap-around', () => {
      const code = `
        : f
          3 buffer var buf
          1 &buf write
          2 &buf write
          3 &buf write
          &buf read drop
          4 &buf write
          &buf buf-size
        ;
        f
      `;
      testTacitCode(vm, code, [3]);
    });

    test('works with alias push', () => {
      const code = `
        : f
          10 buffer var buf
          42 &buf push
          &buf buf-size
        ;
        f
      `;
      testTacitCode(vm, code, [1]);
    });
  });

  describe('unwrite (stack operation)', () => {
    test('returns last written value', () => {
      const code = `
        : f
          10 buffer var buf
          42 &buf write 43 &buf write
          &buf unwrite
        ;
        f
      `;
      testTacitCode(vm, code, [43]);
    });

    test('decrements size', () => {
      const code = `
        : f
          10 buffer var buf
          42 &buf write 43 &buf write
          &buf unwrite drop
          &buf buf-size
        ;
        f
      `;
      testTacitCode(vm, code, [1]);
    });

    test('throws error on underflow', () => {
      expect(() => executeTacitCode(vm, '10 buffer unwrite')).toThrow('Buffer underflow');
    });

    test('supports wrap-around', () => {
      const code = `
        : f
          3 buffer var buf
          1 &buf write 2 &buf write 3 &buf write
          &buf read drop
          4 &buf write
          &buf unwrite
        ;
        f
      `;
      testTacitCode(vm, code, [4]);
    });

    test('works with alias pop', () => {
      const code = `
        : f
          10 buffer var buf
          42 &buf write
          &buf pop
        ;
        f
      `;
      testTacitCode(vm, code, [42]);
    });
  });

  describe('read (queue operation)', () => {
    test('returns first value (FIFO)', () => {
      const code = `
        : f
          10 buffer var buf
          42 &buf write 43 &buf write
          &buf read
        ;
        f
      `;
      testTacitCode(vm, code, [42]);
    });

    test('reads in FIFO order', () => {
      const code = `
        : f
          10 buffer var buf
          1 &buf write 2 &buf write 3 &buf write
          &buf read &buf read &buf read
        ;
        f
      `;
      testTacitCode(vm, code, [1, 2, 3]);
    });

    test('throws error on underflow', () => {
      expect(() => executeTacitCode(vm, '10 buffer read')).toThrow('Buffer underflow');
    });

    test('supports wrap-around', () => {
      const code = `
        : f
          3 buffer var buf
          1 &buf write 2 &buf write 3 &buf write
          &buf read drop
          4 &buf write
          &buf read
        ;
        f
      `;
      testTacitCode(vm, code, [2]);
    });

    test('works with alias shift', () => {
      const code = `
        : f
          10 buffer var buf
          42 &buf write
          &buf shift
        ;
        f
      `;
      testTacitCode(vm, code, [42]);
    });
  });

  describe('unread (queue operation)', () => {
    test('pushes value back', () => {
      const code = `
        : f
          10 buffer var buf
          42 &buf write
          &buf read drop
          100 &buf unread
          &buf read
        ;
        f
      `;
      testTacitCode(vm, code, [100]);
    });

    test('throws error when full', () => {
      const code = `
        : f
          3 buffer var buf
          1 &buf write
          2 &buf write
          3 &buf write
          4 &buf unread
        ;
        f
      `;
      expect(() => executeTacitCode(vm, code)).toThrow('Buffer full, cannot unread');
    });

    test('works with alias unshift', () => {
      const code = `
        : f
          10 buffer var buf
          42 &buf write
          &buf read drop
          100 &buf unshift
          &buf read
        ;
        f
      `;
      testTacitCode(vm, code, [100]);
    });
  });

  describe('ref integration', () => {
    test('works with local variables', () => {
      const code = `
        : f
          10 buffer var buf
          42 &buf write
          &buf buf-size
        ;
        f
      `;
      testTacitCode(vm, code, [1]);
    });

    test('mutates buffer in-place via ref', () => {
      const code = `
        : f
          10 buffer var buf
          42 &buf write
          &buf buf-size
          43 &buf write
          &buf buf-size
        ;
        f
      `;
      testTacitCode(vm, code, [1, 2]);
    });
  });

  describe('address-increasing order', () => {
    test('stores data in address-increasing order for text buffers', () => {
      // Create buffer and write characters
      const code = `
        : f
          10 buffer var buf
          104 &buf write
          101 &buf write
          108 &buf write
          108 &buf write
          111 &buf write
        ;
        f
      `;
      executeTacitCode(vm, code);

      // Get ref to buffer from local variable
      // We need to access the local variable slot
      // For now, let's use a different approach - create buffer on stack and use it
      executeTacitCode(vm, '10 buffer');
      const bufHeader = vm.memory.readCell(vm.sp - 1);

      // Write "hello" as character codes
      executeTacitCode(vm, '104 swap write', false);
      executeTacitCode(vm, '101 swap write', false);
      executeTacitCode(vm, '108 swap write', false);
      executeTacitCode(vm, '108 swap write', false);
      executeTacitCode(vm, '111 swap write', false);

      // Resolve buffer to get header cell
      const bounds = getListBounds(vm, bufHeader);
      expect(bounds).not.toBeNull();
      if (!bounds) return;

      const { headerCell } = bounds;
      const capacity = getListLength(bounds.header) - 2; // N = payloadSlots - 2
      const dataBase = headerCell - (capacity + 2);

      // Read data in address-increasing order (data[0] through data[4])
      const chars: number[] = [];
      for (let i = 0; i < 5; i++) {
        chars.push(vm.memory.readCell(dataBase + i));
      }

      // Should be in order: h, e, l, l, o
      expect(chars).toEqual([104, 101, 108, 108, 111]);
    });
  });

  describe('pointer validation', () => {
    test('pointers remain as simple numbers after mutations', () => {
      const code = `
        : f
          10 buffer var buf
          42 &buf write 43 &buf write 44 &buf write
          &buf unwrite
          &buf read
        ;
        f
      `;
      executeTacitCode(vm, code);

      // We need to access the buffer from the local variable
      // For this test, let's create buffer on stack directly
      executeTacitCode(vm, '10 buffer dup 42 swap write 43 swap write 44 swap write swap drop');
      executeTacitCode(vm, 'dup swap unwrite drop', false);
      executeTacitCode(vm, 'dup swap read drop', false);

      // Get buffer header
      const bufHeader = vm.memory.readCell(vm.sp - 1);
      const bounds = getListBounds(vm, bufHeader);
      expect(bounds).not.toBeNull();
      if (!bounds) return;

      const headerCell = bounds.headerCell;
      const readPtr = vm.memory.readCell(headerCell - 1);
      const writePtr = vm.memory.readCell(headerCell - 2);

      // Pointers should be simple numbers (not NaN-boxed)
      expect(typeof readPtr).toBe('number');
      expect(typeof writePtr).toBe('number');
      expect(Number.isNaN(readPtr)).toBe(false);
      expect(Number.isNaN(writePtr)).toBe(false);
      expect(readPtr).toBeGreaterThanOrEqual(0);
      expect(writePtr).toBeGreaterThanOrEqual(0);
    });
  });

  describe('edge cases', () => {
    test('capacity 1 buffer can hold one element', () => {
      const code = `
        : f
          1 buffer var buf
          42 &buf write
          &buf buf-size &buf is-full
        ;
        f
      `;
      testTacitCode(vm, code, [1, 1]);
    });

    test('capacity 1 buffer throws on second write', () => {
      const code = `
        : f
          1 buffer var buf
          42 &buf write 43 &buf write
        ;
        f
      `;
      expect(() => executeTacitCode(vm, code)).toThrow('Buffer overflow');
    });

    test('mixed stack and queue operations', () => {
      const code = `
        : f
          10 buffer var buf
          1 &buf write 2 &buf write 3 &buf write
          &buf read
          &buf unwrite
          &buf read
        ;
        f
      `;
      testTacitCode(vm, code, [1, 3, 2]);
    });
  });
});

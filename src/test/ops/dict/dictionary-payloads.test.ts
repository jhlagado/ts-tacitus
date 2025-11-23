import { describe, test, expect, beforeEach } from '@jest/globals';
import { createVM, type VM } from '../../../core/vm';
import { Tag, getTaggedInfo, isNIL, Tagged } from '../../../core';
import { lookup, mark, forget, define } from '../../../core/dictionary';
import { createRef, createGlobalRef, getCellFromRef } from '../../../core/refs';
import { createCodeRef, encodeX1516 } from '../../../core/code-ref';
import { GLOBAL_BASE } from '../../../core/constants';

describe('Dictionary payload types', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM();
  });

  describe('Local variables (Tag.LOCAL)', () => {
    test('defineLocal creates LOCAL entry with slot number', () => {
      const name = 'x';
      const slot = vm.compile.localCount++;
      define(vm, name, Tagged(slot, Tag.LOCAL));
      const tv = lookup(vm, name);
      expect(tv).toBeDefined();
      expect(isNIL(tv)).toBe(false);

      const info = getTaggedInfo(tv);
      expect(info.tag).toBe(Tag.LOCAL);
      expect(info.value).toBe(0); // First local gets slot 0
      expect(info.meta).toBe(0);
    });

    test('multiple locals get sequential slot numbers', () => {
      const slotA = vm.compile.localCount++;
      define(vm, 'a', Tagged(slotA, Tag.LOCAL));
      const slotB = vm.compile.localCount++;
      define(vm, 'b', Tagged(slotB, Tag.LOCAL));
      const slotC = vm.compile.localCount++;
      define(vm, 'c', Tagged(slotC, Tag.LOCAL));

      const a = getTaggedInfo(lookup(vm, 'a')!);
      const b = getTaggedInfo(lookup(vm, 'b')!);
      const c = getTaggedInfo(lookup(vm, 'c')!);

      expect(a.tag).toBe(Tag.LOCAL);
      expect(a.value).toBe(0);
      expect(b.tag).toBe(Tag.LOCAL);
      expect(b.value).toBe(1);
      expect(c.tag).toBe(Tag.LOCAL);
      expect(c.value).toBe(2);
    });

    test('locals can be looked up by name', () => {
      const slot = vm.compile.localCount++;
      define(vm, 'counter', Tagged(slot, Tag.LOCAL));
      const tv = lookup(vm, 'counter');
      expect(isNIL(tv)).toBe(false);
      const info = getTaggedInfo(tv);
      expect(info.tag).toBe(Tag.LOCAL);
    });
  });

  describe('CODE entries (Tag.CODE)', () => {
    test('defineCode creates CODE entry with bytecode address', () => {
      const name = 'my-func';
      const address = 0x1238;
      define(vm, name, Tagged(encodeX1516(address), Tag.CODE, 0));
      const tv = lookup(vm, name);
      expect(tv).toBeDefined();
      expect(isNIL(tv)).toBe(false);

      const info = getTaggedInfo(tv);
      expect(info.tag).toBe(Tag.CODE);
      expect(info.value).toBe(encodeX1516(address)); // Value is X1516 encoded
      expect(info.meta).toBe(0);
    });

    test('defineCode with immediate flag sets meta=1', () => {
      const name = 'imm-func';
      const address = 0x5678;
      define(vm, name, Tagged(encodeX1516(address), Tag.CODE, 1));
      const tv = lookup(vm, name);
      const info = getTaggedInfo(tv);
      expect(info.tag).toBe(Tag.CODE);
      expect(info.value).toBe(encodeX1516(address)); // Value is X1516 encoded
      expect(info.meta).toBe(1);
    });
  });

  describe('REF entries (Tag.REF)', () => {
    test('define with REF creates entry with REF payload', () => {
      const name = 'my-ref';
      // Create a REF pointing to a global cell
      const globalCellIndex = 5; // Relative to GLOBAL_BASE
      const ref = createGlobalRef(globalCellIndex);

      define(vm, name, ref);
      const tv = lookup(vm, name);
      expect(tv).toBeDefined();
      expect(isNIL(tv)).toBe(false);

      const info = getTaggedInfo(tv);
      expect(info.tag).toBe(Tag.REF);

      // Decode and verify the absolute cell index
      const cellIndex = getCellFromRef(tv);
      expect(cellIndex).toBe(GLOBAL_BASE + globalCellIndex);
    });

    test('REF can reference any data segment cell', () => {
      const name = 'ref';
      // Create a REF with an absolute cell index
      const cellIndex = GLOBAL_BASE + 10;
      const ref = createRef(cellIndex);

      define(vm, name, ref);
      const tv = lookup(vm, name);
      const info = getTaggedInfo(tv);
      expect(info.tag).toBe(Tag.REF);

      const decoded = getCellFromRef(tv);
      expect(decoded).toBe(cellIndex);
    });

    test('multiple REF entries can reference different cells', () => {
      const ref1 = createGlobalRef(0);
      const ref2 = createGlobalRef(1);
      const ref3 = createGlobalRef(2);

      define(vm, 'ref0', ref1);
      define(vm, 'ref1', ref2);
      define(vm, 'ref2', ref3);

      const tv1 = lookup(vm, 'ref0');
      const tv2 = lookup(vm, 'ref1');
      const tv3 = lookup(vm, 'ref2');

      const idx1 = getCellFromRef(tv1);
      const idx2 = getCellFromRef(tv2);
      const idx3 = getCellFromRef(tv3);

      expect(idx1).toBe(GLOBAL_BASE + 0);
      expect(idx2).toBe(GLOBAL_BASE + 1);
      expect(idx3).toBe(GLOBAL_BASE + 2);
    });

    test('REF can be looked up and decoded correctly', () => {
      const globalCellIndex = 42;
      const ref = createGlobalRef(globalCellIndex);
      define(vm, 'pointer', ref);

      const tv = lookup(vm, 'pointer');
      expect(isNIL(tv)).toBe(false);

      const cellIndex = getCellFromRef(tv);
      expect(cellIndex).toBe(GLOBAL_BASE + globalCellIndex);
    });
  });

  describe('CODE_REF entries (Tag.CODE via createCodeRef)', () => {
    test('define with CODE_REF creates entry with CODE payload', () => {
      const name = 'my-code-ref';
      const bytecodeAddr = 0x1238;
      const codeRef = createCodeRef(bytecodeAddr);

      define(vm, name, codeRef);
      const tv = lookup(vm, name);
      expect(tv).toBeDefined();
      expect(isNIL(tv)).toBe(false);

      const info = getTaggedInfo(tv);
      expect(info.tag).toBe(Tag.CODE);
      expect(info.value).toBe(encodeX1516(bytecodeAddr)); // Value is X1516 encoded
      expect(info.meta).toBe(0);
    });

    test('CODE_REF can reference different bytecode addresses', () => {
      const addr1 = 0x1000;
      const addr2 = 0x2000;
      const addr3 = 0x3000;

      const ref1 = createCodeRef(addr1);
      const ref2 = createCodeRef(addr2);
      const ref3 = createCodeRef(addr3);

      define(vm, 'func1', ref1);
      define(vm, 'func2', ref2);
      define(vm, 'func3', ref3);

      const tv1 = lookup(vm, 'func1');
      const tv2 = lookup(vm, 'func2');
      const tv3 = lookup(vm, 'func3');

      expect(getTaggedInfo(tv1).value).toBe(encodeX1516(addr1)); // Value is X1516 encoded
      expect(getTaggedInfo(tv2).value).toBe(encodeX1516(addr2)); // Value is X1516 encoded
      expect(getTaggedInfo(tv3).value).toBe(encodeX1516(addr3)); // Value is X1516 encoded
    });

    test('CODE_REF can be looked up and decoded correctly', () => {
      const bytecodeAddr = 0x5678;
      const codeRef = createCodeRef(bytecodeAddr);
      define(vm, 'code-pointer', codeRef);

      const tv = lookup(vm, 'code-pointer');
      expect(isNIL(tv)).toBe(false);

      const info = getTaggedInfo(tv);
      expect(info.tag).toBe(Tag.CODE);
      expect(info.value).toBe(encodeX1516(bytecodeAddr)); // Value is X1516 encoded
    });

    test('CODE_REF is equivalent to defineCode result', () => {
      const bytecodeAddr = 0x2000; // Use valid address (0-32767)
      const codeRef = createCodeRef(bytecodeAddr);
      define(vm, 'via-ref', codeRef);

      // Compare with defineCode
      define(vm, 'via-define', Tagged(encodeX1516(bytecodeAddr), Tag.CODE, 0));

      const refTv = lookup(vm, 'via-ref');
      const defineTv = lookup(vm, 'via-define');

      const refInfo = getTaggedInfo(refTv);
      const defineInfo = getTaggedInfo(defineTv);

      expect(refInfo.tag).toBe(defineInfo.tag);
      expect(refInfo.value).toBe(defineInfo.value);
      expect(refInfo.meta).toBe(defineInfo.meta);
    });
  });

  describe('Mixed payload types', () => {
    test('can define BUILTIN, CODE, and LOCAL in same dictionary', () => {
      define(vm, 'add-op', Tagged(42, Tag.CODE, 0));
      define(vm, 'user-func', Tagged(encodeX1516(0x1000), Tag.CODE, 0));
      const slot = vm.compile.localCount++;
      define(vm, 'local-var', Tagged(slot, Tag.LOCAL));

      const builtin = getTaggedInfo(lookup(vm, 'add-op')!);
      const code = getTaggedInfo(lookup(vm, 'user-func')!);
      const local = getTaggedInfo(lookup(vm, 'local-var')!);

      expect(builtin.tag).toBe(Tag.CODE);
      expect(code.tag).toBe(Tag.CODE);
      expect(local.tag).toBe(Tag.LOCAL);
    });

    test('can define BUILTIN, CODE, LOCAL, and REF in same dictionary', () => {
      define(vm, 'add-op', Tagged(42, Tag.CODE, 0));
      define(vm, 'user-func', Tagged(encodeX1516(0x1000), Tag.CODE, 0));
      const slot = vm.compile.localCount++;
      define(vm, 'local-var', Tagged(slot, Tag.LOCAL));
      const testRef = createGlobalRef(10);
      define(vm, 'pointer', testRef);

      const builtin = getTaggedInfo(lookup(vm, 'add-op')!);
      const code = getTaggedInfo(lookup(vm, 'user-func')!);
      const local = getTaggedInfo(lookup(vm, 'local-var')!);
      const ref = getTaggedInfo(lookup(vm, 'pointer')!);

      expect(builtin.tag).toBe(Tag.CODE);
      expect(code.tag).toBe(Tag.CODE);
      expect(local.tag).toBe(Tag.LOCAL);
      expect(ref.tag).toBe(Tag.REF);
    });

    test('can define BUILTIN, CODE_REF, LOCAL, and REF in same dictionary', () => {
      define(vm, 'add-op', Tagged(42, Tag.CODE, 0));
      const codeRef = createCodeRef(0x2000);
      define(vm, 'code-ref', codeRef);
      const slot = vm.compile.localCount++;
      define(vm, 'local-var', Tagged(slot, Tag.LOCAL));
      const testRef = createGlobalRef(10);
      define(vm, 'pointer', testRef);

      const builtin = getTaggedInfo(lookup(vm, 'add-op')!);
      const code = getTaggedInfo(lookup(vm, 'code-ref')!);
      const local = getTaggedInfo(lookup(vm, 'local-var')!);
      const ref = getTaggedInfo(lookup(vm, 'pointer')!);

      expect(builtin.tag).toBe(Tag.CODE);
      expect(code.tag).toBe(Tag.CODE);
      expect(local.tag).toBe(Tag.LOCAL);
      expect(ref.tag).toBe(Tag.REF);
    });

    test('lookup finds most recent entry (LIFO order)', () => {
      // Define same name with different types
      define(vm, 'foo', Tagged(10, Tag.CODE, 0));
      define(vm, 'foo', Tagged(encodeX1516(0x2000), Tag.CODE, 0));
      const slot = vm.compile.localCount++;
      define(vm, 'foo', Tagged(slot, Tag.LOCAL));

      // Should find the most recent (LOCAL)
      const tv = lookup(vm, 'foo');
      const info = getTaggedInfo(tv);
      expect(info.tag).toBe(Tag.LOCAL);
    });
  });

  describe('Mark and forget (scope management)', () => {
    test('mark returns current heap position', () => {
      const initialGp = vm.gp;
      const initialHead = vm.compile.head;

      // Define some entries
      define(vm, 'global1', Tagged(1, Tag.CODE, 0));
      define(vm, 'global2', Tagged(2, Tag.CODE, 0));
      const gpAfter = vm.gp;
      const headAfter = vm.compile.head;

      const markPos = mark(vm);
      expect(markPos).toBe(gpAfter);
      expect(markPos).toBeGreaterThan(initialGp);
      expect(headAfter).toBeGreaterThan(initialHead);
    });

    test('forget reverts heap and dictionary to mark position', () => {
      // Define some global entries
      define(vm, 'global-a', Tagged(10, Tag.CODE, 0));
      define(vm, 'global-b', Tagged(20, Tag.CODE, 0));
      const markPos = mark(vm);
      const headAtMark = vm.compile.head;

      // Define local entries (should be removed by forget)
      const slotX = vm.compile.localCount++;
      define(vm, 'local-x', Tagged(slotX, Tag.LOCAL));
      const slotY = vm.compile.localCount++;
      define(vm, 'local-y', Tagged(slotY, Tag.LOCAL));
      define(vm, 'temp-op', Tagged(99, Tag.CODE, 0));

      // Verify they exist
      expect(isNIL(lookup(vm, 'local-x'))).toBe(false);
      expect(isNIL(lookup(vm, 'local-y'))).toBe(false);
      expect(isNIL(lookup(vm, 'temp-op'))).toBe(false);

      // Forget should remove everything after mark
      forget(vm, markPos);

      // Locals and temp should be gone
      expect(isNIL(lookup(vm, 'local-x'))).toBe(true);
      expect(isNIL(lookup(vm, 'local-y'))).toBe(true);
      expect(isNIL(lookup(vm, 'temp-op'))).toBe(true);

      // Globals should still exist
      expect(isNIL(lookup(vm, 'global-a'))).toBe(false);
      expect(isNIL(lookup(vm, 'global-b'))).toBe(false);

      // Head should be restored
      expect(vm.compile.head).toBe(headAtMark);
      expect(vm.gp).toBe(markPos);
    });

    test('forget handles nested scopes correctly', () => {
      // Outer scope
      define(vm, 'outer1', Tagged(1, Tag.CODE, 0));
      const outerMark = mark(vm);

      // Inner scope 1
      const slot1X = vm.compile.localCount++;
      define(vm, 'inner1-x', Tagged(slot1X, Tag.LOCAL));
      const slot1Y = vm.compile.localCount++;
      define(vm, 'inner1-y', Tagged(slot1Y, Tag.LOCAL));
      const inner1Mark = mark(vm);

      // Inner scope 2
      const slot2A = vm.compile.localCount++;
      define(vm, 'inner2-a', Tagged(slot2A, Tag.LOCAL));
      const inner2Mark = mark(vm);

      // Deepest scope
      define(vm, 'deep-op', Tagged(100, Tag.CODE, 0));

      // Revert inner2
      forget(vm, inner2Mark);
      expect(isNIL(lookup(vm, 'deep-op'))).toBe(true);
      expect(isNIL(lookup(vm, 'inner2-a'))).toBe(false); // Still exists

      // Revert inner1
      forget(vm, inner1Mark);
      expect(isNIL(lookup(vm, 'inner2-a'))).toBe(true);
      expect(isNIL(lookup(vm, 'inner1-x'))).toBe(false); // Still exists

      // Revert outer
      forget(vm, outerMark);
      expect(isNIL(lookup(vm, 'inner1-x'))).toBe(true);
      expect(isNIL(lookup(vm, 'outer1'))).toBe(false); // Still exists
    });

    test('forget with empty dictionary sets head to 0', () => {
      // Clear dictionary and reset heap to get empty state
      vm.compile.head = 0;
      vm.gp = 0;

      const markPos = mark(vm);
      expect(vm.compile.head).toBe(0);
      expect(vm.gp).toBe(0);

      // Add and remove entries
      const slot = vm.compile.localCount++;
      define(vm, 'temp', Tagged(slot, Tag.LOCAL));
      expect(vm.compile.head).not.toBe(0);
      forget(vm, markPos);

      expect(vm.compile.head).toBe(0);
      expect(vm.gp).toBe(0);
    });

    test('forget updates head correctly', () => {
      define(vm, 'test', Tagged(1, Tag.CODE, 0));
      const markPos = mark(vm);
      const headBefore = vm.compile.head;

      const slot = vm.compile.localCount++;
      define(vm, 'local', Tagged(slot, Tag.LOCAL));
      forget(vm, markPos);

      expect(vm.compile.head).toBe(headBefore);
      // Verify head is a valid cell index
      expect(vm.compile.head).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Local variable slot allocation', () => {
    test('localCount increments for each local', () => {
      expect(vm.compile.localCount).toBe(0);
      const slotA = vm.compile.localCount++;
      define(vm, 'a', Tagged(slotA, Tag.LOCAL));
      expect(vm.compile.localCount).toBe(1);
      const slotB = vm.compile.localCount++;
      define(vm, 'b', Tagged(slotB, Tag.LOCAL));
      expect(vm.compile.localCount).toBe(2);
      const slotC = vm.compile.localCount++;
      define(vm, 'c', Tagged(slotC, Tag.LOCAL));
      expect(vm.compile.localCount).toBe(3);
    });

    test('localCount persists after mark (mark only tracks heap position)', () => {
      const slotX = vm.compile.localCount++;
      define(vm, 'x', Tagged(slotX, Tag.LOCAL));
      expect(vm.compile.localCount).toBe(1);

      const _markPos = mark(vm);
      // Note: dictionary mark() only returns heap position, doesn't reset localCount
      // Symbol table mark() would reset it, but we're testing dictionary directly
      expect(vm.compile.localCount).toBe(1);

      const slotY = vm.compile.localCount++;
      define(vm, 'y', Tagged(slotY, Tag.LOCAL));
      expect(vm.compile.localCount).toBe(2);
    });

    test('localCount persists across forget (forget only reverts heap)', () => {
      const slotA = vm.compile.localCount++;
      define(vm, 'a', Tagged(slotA, Tag.LOCAL));
      const slotB = vm.compile.localCount++;
      define(vm, 'b', Tagged(slotB, Tag.LOCAL));
      const _markPos = mark(vm);
      // localCount is 2 (a and b were defined)
      expect(vm.compile.localCount).toBe(2);

      const slotC = vm.compile.localCount++;
      define(vm, 'c', Tagged(slotC, Tag.LOCAL));
      expect(vm.compile.localCount).toBe(3);
      forget(vm, _markPos);
      // localCount is not reset by forget - it only reverts heap/dictionary
      // The localCount would be reset by symbol table mark(), not dictionary mark()
      expect(vm.compile.localCount).toBe(3);
    });
  });

  describe('Edge cases', () => {
    test('lookup returns NIL for non-existent name', () => {
      const tv = lookup(vm, 'nonexistent');
      expect(isNIL(tv)).toBe(true);
    });

    test('forget with invalid mark throws error', () => {
      define(vm, 'test', Tagged(1, Tag.CODE, 0));
      expect(() => forget(vm, -1)).toThrow('forget mark out of range');
      expect(() => forget(vm, vm.gp + 1)).toThrow('forget mark beyond current heap top');
    });

    test('multiple entries with same name - lookup finds most recent', () => {
      define(vm, 'dup', Tagged(10, Tag.CODE, 0));
      define(vm, 'dup', Tagged(encodeX1516(0x3000), Tag.CODE, 0));
      const slot = vm.compile.localCount++;
      define(vm, 'dup', Tagged(slot, Tag.LOCAL));

      const tv = lookup(vm, 'dup');
      const info = getTaggedInfo(tv);
      expect(info.tag).toBe(Tag.LOCAL); // Most recent
    });
  });
});

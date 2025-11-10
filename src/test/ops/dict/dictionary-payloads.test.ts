import { describe, test, expect, beforeEach } from '@jest/globals';
import { createVM, type VM } from '../../../core/vm';
import { Tag, fromTaggedValue, isNIL, toTaggedValue } from '../../../core';
import {
  defineBuiltin,
  defineCode,
  defineLocal,
  lookup,
  mark,
  forget,
  define,
} from '../../../core/dictionary';
import { createRef, createGlobalRef, decodeRef } from '../../../core/refs';
import { createCodeRef } from '../../../core/code-ref';
import { GLOBAL_BASE } from '../../../core/constants';

describe('Dictionary payload types', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM();
  });

  describe('Local variables (Tag.LOCAL)', () => {
    test('defineLocal creates LOCAL entry with slot number', () => {
      const name = 'x';
      defineLocal(vm, name);
      const tv = lookup(vm, name);
      expect(tv).toBeDefined();
      expect(isNIL(tv)).toBe(false);

      const info = fromTaggedValue(tv);
      expect(info.tag).toBe(Tag.LOCAL);
      expect(info.value).toBe(0); // First local gets slot 0
      expect(info.meta).toBe(0);
    });

    test('multiple locals get sequential slot numbers', () => {
      defineLocal(vm, 'a');
      defineLocal(vm, 'b');
      defineLocal(vm, 'c');

      const a = fromTaggedValue(lookup(vm, 'a')!);
      const b = fromTaggedValue(lookup(vm, 'b')!);
      const c = fromTaggedValue(lookup(vm, 'c')!);

      expect(a.tag).toBe(Tag.LOCAL);
      expect(a.value).toBe(0);
      expect(b.tag).toBe(Tag.LOCAL);
      expect(b.value).toBe(1);
      expect(c.tag).toBe(Tag.LOCAL);
      expect(c.value).toBe(2);
    });

    test('locals can be looked up by name', () => {
      defineLocal(vm, 'counter');
      const tv = lookup(vm, 'counter');
      expect(isNIL(tv)).toBe(false);
      const info = fromTaggedValue(tv);
      expect(info.tag).toBe(Tag.LOCAL);
    });
  });

  describe('CODE entries (Tag.CODE)', () => {
    test('defineCode creates CODE entry with bytecode address', () => {
      const name = 'my-func';
      const address = 0x1234;
      defineCode(vm, name, address, false);
      const tv = lookup(vm, name);
      expect(tv).toBeDefined();
      expect(isNIL(tv)).toBe(false);

      const info = fromTaggedValue(tv);
      expect(info.tag).toBe(Tag.CODE);
      expect(info.value).toBe(address);
      expect(info.meta).toBe(0);
    });

    test('defineCode with immediate flag sets meta=1', () => {
      const name = 'imm-func';
      const address = 0x5678;
      defineCode(vm, name, address, true);
      const tv = lookup(vm, name);
      const info = fromTaggedValue(tv);
      expect(info.tag).toBe(Tag.CODE);
      expect(info.value).toBe(address);
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

      const info = fromTaggedValue(tv);
      expect(info.tag).toBe(Tag.REF);

      // Decode and verify the absolute cell index
      const { cellIndex } = decodeRef(tv);
      expect(cellIndex).toBe(GLOBAL_BASE + globalCellIndex);
    });

    test('REF can reference any data segment cell', () => {
      const name = 'ref';
      // Create a REF with an absolute cell index
      const cellIndex = GLOBAL_BASE + 10;
      const ref = createRef(cellIndex);

      define(vm, name, ref);
      const tv = lookup(vm, name);
      const info = fromTaggedValue(tv);
      expect(info.tag).toBe(Tag.REF);

      const { cellIndex: decoded } = decodeRef(tv);
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

      const { cellIndex: idx1 } = decodeRef(tv1);
      const { cellIndex: idx2 } = decodeRef(tv2);
      const { cellIndex: idx3 } = decodeRef(tv3);

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

      const { cellIndex } = decodeRef(tv);
      expect(cellIndex).toBe(GLOBAL_BASE + globalCellIndex);
    });
  });

  describe('CODE_REF entries (Tag.CODE via createCodeRef)', () => {
    test('define with CODE_REF creates entry with CODE payload', () => {
      const name = 'my-code-ref';
      const bytecodeAddr = 0x1234;
      const codeRef = createCodeRef(bytecodeAddr);

      define(vm, name, codeRef);
      const tv = lookup(vm, name);
      expect(tv).toBeDefined();
      expect(isNIL(tv)).toBe(false);

      const info = fromTaggedValue(tv);
      expect(info.tag).toBe(Tag.CODE);
      expect(info.value).toBe(bytecodeAddr);
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

      expect(fromTaggedValue(tv1).value).toBe(addr1);
      expect(fromTaggedValue(tv2).value).toBe(addr2);
      expect(fromTaggedValue(tv3).value).toBe(addr3);
    });

    test('CODE_REF can be looked up and decoded correctly', () => {
      const bytecodeAddr = 0x5678;
      const codeRef = createCodeRef(bytecodeAddr);
      define(vm, 'code-pointer', codeRef);

      const tv = lookup(vm, 'code-pointer');
      expect(isNIL(tv)).toBe(false);

      const info = fromTaggedValue(tv);
      expect(info.tag).toBe(Tag.CODE);
      expect(info.value).toBe(bytecodeAddr);
    });

    test('CODE_REF is equivalent to defineCode result', () => {
      const bytecodeAddr = 0xabcd;
      const codeRef = createCodeRef(bytecodeAddr);
      define(vm, 'via-ref', codeRef);

      // Compare with defineCode
      defineCode(vm, 'via-define', bytecodeAddr, false);

      const refTv = lookup(vm, 'via-ref');
      const defineTv = lookup(vm, 'via-define');

      const refInfo = fromTaggedValue(refTv);
      const defineInfo = fromTaggedValue(defineTv);

      expect(refInfo.tag).toBe(defineInfo.tag);
      expect(refInfo.value).toBe(defineInfo.value);
      expect(refInfo.meta).toBe(defineInfo.meta);
    });
  });

  describe('Mixed payload types', () => {
    test('can define BUILTIN, CODE, and LOCAL in same dictionary', () => {
      defineBuiltin(vm, 'add-op', 42, false);
      defineCode(vm, 'user-func', 0x1000, false);
      defineLocal(vm, 'local-var');

      const builtin = fromTaggedValue(lookup(vm, 'add-op')!);
      const code = fromTaggedValue(lookup(vm, 'user-func')!);
      const local = fromTaggedValue(lookup(vm, 'local-var')!);

      expect(builtin.tag).toBe(Tag.BUILTIN);
      expect(code.tag).toBe(Tag.CODE);
      expect(local.tag).toBe(Tag.LOCAL);
    });

    test('can define BUILTIN, CODE, LOCAL, and REF in same dictionary', () => {
      defineBuiltin(vm, 'add-op', 42, false);
      defineCode(vm, 'user-func', 0x1000, false);
      defineLocal(vm, 'local-var');
      const testRef = createGlobalRef(10);
      define(vm, 'pointer', testRef);

      const builtin = fromTaggedValue(lookup(vm, 'add-op')!);
      const code = fromTaggedValue(lookup(vm, 'user-func')!);
      const local = fromTaggedValue(lookup(vm, 'local-var')!);
      const ref = fromTaggedValue(lookup(vm, 'pointer')!);

      expect(builtin.tag).toBe(Tag.BUILTIN);
      expect(code.tag).toBe(Tag.CODE);
      expect(local.tag).toBe(Tag.LOCAL);
      expect(ref.tag).toBe(Tag.REF);
    });

    test('can define BUILTIN, CODE_REF, LOCAL, and REF in same dictionary', () => {
      defineBuiltin(vm, 'add-op', 42, false);
      const codeRef = createCodeRef(0x2000);
      define(vm, 'code-ref', codeRef);
      defineLocal(vm, 'local-var');
      const testRef = createGlobalRef(10);
      define(vm, 'pointer', testRef);

      const builtin = fromTaggedValue(lookup(vm, 'add-op')!);
      const code = fromTaggedValue(lookup(vm, 'code-ref')!);
      const local = fromTaggedValue(lookup(vm, 'local-var')!);
      const ref = fromTaggedValue(lookup(vm, 'pointer')!);

      expect(builtin.tag).toBe(Tag.BUILTIN);
      expect(code.tag).toBe(Tag.CODE);
      expect(local.tag).toBe(Tag.LOCAL);
      expect(ref.tag).toBe(Tag.REF);
    });

    test('lookup finds most recent entry (LIFO order)', () => {
      // Define same name with different types
      defineBuiltin(vm, 'foo', 10, false);
      defineCode(vm, 'foo', 0x2000, false);
      defineLocal(vm, 'foo');

      // Should find the most recent (LOCAL)
      const tv = lookup(vm, 'foo');
      const info = fromTaggedValue(tv);
      expect(info.tag).toBe(Tag.LOCAL);
    });
  });

  describe('Mark and forget (scope management)', () => {
    test('mark returns current heap position', () => {
      const initialGp = vm.gp;
      const initialHead = vm.head;

      // Define some entries
      defineBuiltin(vm, 'global1', 1, false);
      defineBuiltin(vm, 'global2', 2, false);
      const gpAfter = vm.gp;
      const headAfter = vm.head;

      const markPos = mark(vm);
      expect(markPos).toBe(gpAfter);
      expect(markPos).toBeGreaterThan(initialGp);
      expect(headAfter).toBeGreaterThan(initialHead);
    });

    test('forget reverts heap and dictionary to mark position', () => {
      // Define some global entries
      defineBuiltin(vm, 'global-a', 10, false);
      defineBuiltin(vm, 'global-b', 20, false);
      const markPos = mark(vm);
      const headAtMark = vm.head;

      // Define local entries (should be removed by forget)
      defineLocal(vm, 'local-x');
      defineLocal(vm, 'local-y');
      defineBuiltin(vm, 'temp-op', 99, false);

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
      expect(vm.head).toBe(headAtMark);
      expect(vm.gp).toBe(markPos);
    });

    test('forget handles nested scopes correctly', () => {
      // Outer scope
      defineBuiltin(vm, 'outer1', 1, false);
      const outerMark = mark(vm);

      // Inner scope 1
      defineLocal(vm, 'inner1-x');
      defineLocal(vm, 'inner1-y');
      const inner1Mark = mark(vm);

      // Inner scope 2
      defineLocal(vm, 'inner2-a');
      const inner2Mark = mark(vm);

      // Deepest scope
      defineBuiltin(vm, 'deep-op', 100, false);

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
      vm.head = 0;
      vm.gp = 0;

      const markPos = mark(vm);
      expect(vm.head).toBe(0);
      expect(vm.gp).toBe(0);

      // Add and remove entries
      defineLocal(vm, 'temp');
      expect(vm.head).not.toBe(0);
      forget(vm, markPos);

      expect(vm.head).toBe(0);
      expect(vm.gp).toBe(0);
    });

    test('forget updates head correctly', () => {
      defineBuiltin(vm, 'test', 1, false);
      const markPos = mark(vm);
      const headBefore = vm.head;

      defineLocal(vm, 'local');
      forget(vm, markPos);

      expect(vm.head).toBe(headBefore);
      // Verify head is a valid cell index
      expect(vm.head).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Local variable slot allocation', () => {
    test('localCount increments for each local', () => {
      expect(vm.localCount).toBe(0);
      defineLocal(vm, 'a');
      expect(vm.localCount).toBe(1);
      defineLocal(vm, 'b');
      expect(vm.localCount).toBe(2);
      defineLocal(vm, 'c');
      expect(vm.localCount).toBe(3);
    });

    test('localCount persists after mark (mark only tracks heap position)', () => {
      defineLocal(vm, 'x');
      expect(vm.localCount).toBe(1);

      const _markPos = mark(vm);
      // Note: dictionary mark() only returns heap position, doesn't reset localCount
      // Symbol table mark() would reset it, but we're testing dictionary directly
      expect(vm.localCount).toBe(1);

      defineLocal(vm, 'y');
      expect(vm.localCount).toBe(2);
    });

    test('localCount persists across forget (forget only reverts heap)', () => {
      defineLocal(vm, 'a');
      defineLocal(vm, 'b');
      const _markPos = mark(vm);
      // localCount is 2 (a and b were defined)
      expect(vm.localCount).toBe(2);

      defineLocal(vm, 'c');
      expect(vm.localCount).toBe(3);
      forget(vm, _markPos);
      // localCount is not reset by forget - it only reverts heap/dictionary
      // The localCount would be reset by symbol table mark(), not dictionary mark()
      expect(vm.localCount).toBe(3);
    });
  });

  describe('Edge cases', () => {
    test('lookup returns NIL for non-existent name', () => {
      const tv = lookup(vm, 'nonexistent');
      expect(isNIL(tv)).toBe(true);
    });

    test('forget with invalid mark throws error', () => {
      defineBuiltin(vm, 'test', 1, false);
      expect(() => forget(vm, -1)).toThrow('forget mark out of range');
      expect(() => forget(vm, vm.gp + 1)).toThrow('forget mark beyond current heap top');
    });

    test('multiple entries with same name - lookup finds most recent', () => {
      defineBuiltin(vm, 'dup', 10, false);
      defineCode(vm, 'dup', 0x3000, false);
      defineLocal(vm, 'dup');

      const tv = lookup(vm, 'dup');
      const info = fromTaggedValue(tv);
      expect(info.tag).toBe(Tag.LOCAL); // Most recent
    });
  });
});

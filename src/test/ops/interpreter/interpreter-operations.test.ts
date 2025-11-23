import { addOp } from '../../../ops/math';
import { dupOp, swapOp } from '../../../ops/stack';
import { createVM, type VM } from '../../../core/vm';
import { Tag, Tagged } from '../../../core/tagged';
import { Op } from '../../../ops/opcodes';
import { RSTACK_BASE, RSTACK_TOP, STACK_BASE } from '../../../core/constants';
import { rpush, push, rpop, getStackData, pop, emitUint16, emitFloat32 } from '../../../core/vm';
import { encodeX1516 } from '../../../core/code-ref';

import {
  abortOp,
  exitOp,
  evalOp,
  branchOp,
  callOp,
  literalNumberOp,
  groupLeftOp,
  groupRightOp,
} from '../../../ops/core';
describe('Built-in Words', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM();
  });
  describe('Control Flow Operations', () => {
    test('abortOp should stop execution', () => {
      abortOp(vm);
      expect(vm.running).toBe(false);
    });
    test('exitOp should restore ip from return stack and BP frame', () => {
      const testAddress = 0x2348;
      // In the migrated model BP is cell-based. Simulate a call frame by
      // pushing return address then saved BP (cells) and setting BP to current RSP.
      const originalBP = vm.bp; // capture current (absolute cells)
      rpush(vm, testAddress);
      // Save BP as relative cells on the return stack
      rpush(vm, originalBP - RSTACK_BASE);
      vm.bp = vm.rsp;
      exitOp(vm);
      expect(vm.ip).toBe(testAddress);
      expect(vm.bp).toBe(originalBP);
    });
    test('evalOp should push ip to return stack, set up BP frame, and jump', () => {
      const testAddress = 0x2348;
      const originalIP = vm.ip;
      const originalBP = vm.bp; // absolute cells
      push(vm, Tagged(encodeX1516(testAddress), Tag.CODE));
      evalOp(vm);
      expect(vm.ip).toBe(testAddress);
      expect(vm.bp).toBe(vm.rsp);
      const savedBP = rpop(vm);
      // Saved BP is relative cells
      expect(savedBP).toBe(originalBP - RSTACK_BASE);
      const returnAddr = rpop(vm);
      expect(returnAddr).toBe(originalIP);
    });
    test('branchOp should jump relative', () => {
      const initialIP = vm.ip;
      emitUint16(vm, 10);
      branchOp(vm);
      expect(vm.ip).toBe(initialIP + 12);
    });
    test('callOp should jump to absolute address and set up BP frame', () => {
      const originalIP = vm.ip;
      const originalBP = vm.bp;
      const offset = 0x1238;
      emitUint16(vm, offset);
      callOp(vm);
      expect(vm.ip).toBe((originalIP + 2 + offset) & 0xffff);
      expect(vm.bp).toBe(vm.rsp);
      const savedBP = rpop(vm);
      expect(savedBP).toBe(originalBP - RSTACK_BASE);
      const returnAddr = rpop(vm);
      expect(returnAddr).toBe(originalIP + 2);
    });
  });
  describe('evalOp with Tag.CODE', () => {
    test('should execute built-in add operation via Tag.CODE', () => {
      push(vm, 2);
      push(vm, 3);
      push(vm, Tagged(Op.Add, Tag.CODE));

      evalOp(vm);

      expect(getStackData(vm)).toEqual([5]);
    });

    test('should execute built-in dup operation via Tag.CODE', () => {
      push(vm, 42);
      push(vm, Tagged(Op.Dup, Tag.CODE));

      evalOp(vm);

      expect(getStackData(vm)).toEqual([42, 42]);
    });

    test('should execute built-in multiply operation via Tag.CODE', () => {
      push(vm, 7);
      push(vm, 8);
      push(vm, Tagged(Op.Multiply, Tag.CODE));

      evalOp(vm);

      expect(getStackData(vm)).toEqual([56]);
    });

    test('should handle non-executable values by pushing back on stack', () => {
      push(vm, 123);

      evalOp(vm);

      expect(getStackData(vm)).toEqual([123]);
    });
  });
  describe('Literal Operations', () => {
    test('literalNumberOp should push numbers', () => {
      emitFloat32(vm, 42);
      literalNumberOp(vm);
      expect(pop(vm)).toBe(42);
    });
    test('should handle tagged pointers', () => {
      const addr = Tagged(encodeX1516(0x2348), Tag.CODE);
      emitFloat32(vm, addr);
      literalNumberOp(vm);
      expect(pop(vm)).toBe(addr);
    });
  });
  describe('Grouping Operations', () => {
    test('groupLeftOp should push the current SP (cells) onto the return stack', () => {
      const initialSP = vm.sp;
      groupLeftOp(vm);
      const savedSP = rpop(vm);
      // groupLeftOp stores relative cells (depth)
      expect(savedSP).toBe(initialSP - STACK_BASE);
    });
    test('groupRightOp should compute the number of stack cells pushed since group left', () => {
      groupLeftOp(vm);
      push(vm, 10);
      push(vm, 20);
      groupRightOp(vm);
      const count = pop(vm);
      expect(count).toBe(2);
    });
  });
  describe('Error Handling', () => {
    test('should show stack state in errors', () => {
      try {
        addOp(vm);
      } catch (e) {
        if (e instanceof Error) {
          expect(e.message).toMatch(/stack: \[\]/);
        }
      }
    });
    test('should handle underflow for swap', () => {
      push(vm, 5);
      expect(() => swapOp(vm)).toThrow(`Stack underflow: 'swap' requires 2 operands (stack: [5])`);
    });
    test('should handle underflow for dup', () => {
      expect(() => dupOp(vm)).toThrow(
        `Stack underflow: 'dup' requires 1 operand (stack: ${JSON.stringify(getStackData(vm))})`,
      );
    });
    test('should handle return stack overflow', () => {
      // Fill return stack to leave exactly one free cell so evalOp's two rpushes overflow
      const available = RSTACK_TOP - vm.rsp; // remaining capacity in cells (public constants)
      for (let i = 0; i < available - 1; i++) {
        rpush(vm, 0);
      }

      // Push a CODE reference so evalOp enters the frame-setup path (which rpushes twice)
      push(vm, Tagged(encodeX1516(0x1238), Tag.CODE));
      // evalOp will attempt to push return ip and saved BP (relative), overflowing on second push
      expect(() => evalOp(vm)).toThrow(/Return stack \(RSP\) overflow/);
    });
  });
});

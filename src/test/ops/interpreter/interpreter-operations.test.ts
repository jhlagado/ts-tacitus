import { addOp } from '../../../ops/math';
import { dupOp, swapOp } from '../../../ops/stack';
import { initializeInterpreter, vm } from '../../../core/global-state';
import { Tag, toTaggedValue } from '../../../core/tagged';
import { toUnsigned16 } from '../../../core/utils';
import { Op } from '../../../ops/opcodes';
import { RSTACK_BASE, RSTACK_TOP, STACK_BASE, CELL_SIZE } from '../../../core/constants';

import {
  abortOp,
  exitOp,
  evalOp,
  skipDefOp,
  callOp,
  literalNumberOp,
  groupLeftOp,
  groupRightOp,
} from '../../../ops/core';
describe('Built-in Words', () => {
  beforeEach(() => {
    initializeInterpreter();
  });
  describe('Control Flow Operations', () => {
    test('abortOp should stop execution', () => {
      abortOp(vm);
      expect(vm.running).toBe(false);
    });
    test('exitOp should restore IP from return stack and BP frame', () => {
      const testAddress = 0x2345;
      // In the migrated model BP is cell-based. Simulate a call frame by
      // pushing return address then saved BP (cells) and setting BP to current RSP.
      const originalBP = vm.bp; // capture current (absolute cells)
      vm.rpush(testAddress);
      // Save BP as relative cells on the return stack
      vm.rpush(originalBP - RSTACK_BASE / CELL_SIZE);
      vm.bp = vm.rsp;
      exitOp(vm);
      expect(vm.IP).toBe(testAddress);
      expect(vm.bp).toBe(originalBP);
    });
    test('evalOp should push IP to return stack, set up BP frame, and jump', () => {
      const testAddress = 0x2345;
      const originalIP = vm.IP;
      const originalBP = vm.bp; // absolute cells
      vm.push(toTaggedValue(testAddress, Tag.CODE));
      evalOp(vm);
      expect(vm.IP).toBe(testAddress);
      expect(vm.bp).toBe(vm.rsp);
      const savedBP = vm.rpop();
      // Saved BP is relative cells
      expect(savedBP).toBe(originalBP - RSTACK_BASE / CELL_SIZE);
      const returnAddr = vm.rpop();
      expect(returnAddr).toBe(originalIP);
    });
    test('branchOp should jump relative', () => {
      const initialIP = vm.IP;
      vm.compiler.compile16(10);
      skipDefOp(vm);
      expect(vm.IP).toBe(initialIP + 12);
    });
    test('callOp should jump to absolute address and set up BP frame', () => {
      const originalIP = vm.IP;
      const originalBP = vm.bp;
      const testAddress = 0x12345;
      vm.compiler.compile16(testAddress);
      callOp(vm);
      expect(vm.IP).toBe(toUnsigned16(testAddress));
      expect(vm.bp).toBe(vm.rsp);
      const savedBP = vm.rpop();
      expect(savedBP).toBe(originalBP - RSTACK_BASE / CELL_SIZE);
      const returnAddr = vm.rpop();
      expect(returnAddr).toBe(originalIP + 2);
    });
  });
  describe('evalOp with Tag.BUILTIN', () => {
    test('should execute built-in add operation via Tag.BUILTIN', () => {
      vm.push(2);
      vm.push(3);
      vm.push(toTaggedValue(Op.Add, Tag.BUILTIN));

      evalOp(vm);

      expect(vm.getStackData()).toEqual([5]);
    });

    test('should execute built-in dup operation via Tag.BUILTIN', () => {
      vm.push(42);
      vm.push(toTaggedValue(Op.Dup, Tag.BUILTIN));

      evalOp(vm);

      expect(vm.getStackData()).toEqual([42, 42]);
    });

    test('should execute built-in multiply operation via Tag.BUILTIN', () => {
      vm.push(7);
      vm.push(8);
      vm.push(toTaggedValue(Op.Multiply, Tag.BUILTIN));

      evalOp(vm);

      expect(vm.getStackData()).toEqual([56]);
    });

    test('should handle non-executable values by pushing back on stack', () => {
      vm.push(123);

      evalOp(vm);

      expect(vm.getStackData()).toEqual([123]);
    });
  });
  describe('Literal Operations', () => {
    test('literalNumberOp should push numbers', () => {
      vm.compiler.compileFloat32(42);
      literalNumberOp(vm);
      expect(vm.pop()).toBe(42);
    });
    test('should handle tagged pointers', () => {
      const addr = toTaggedValue(0x2345, Tag.CODE);
      vm.compiler.compileFloat32(addr);
      literalNumberOp(vm);
      expect(vm.pop()).toBe(addr);
    });
  });
  describe('Grouping Operations', () => {
    test('groupLeftOp should push the current SP (cells) onto the return stack', () => {
      const initialSP = vm.sp;
      groupLeftOp(vm);
      const savedSP = vm.rpop();
      // groupLeftOp stores relative cells (depth)
      expect(savedSP).toBe(initialSP - STACK_BASE / CELL_SIZE);
    });
    test('groupRightOp should compute the number of stack cells pushed since group left', () => {
      groupLeftOp(vm);
      vm.push(10);
      vm.push(20);
      groupRightOp(vm);
      const count = vm.pop();
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
      vm.push(5);
      expect(() => swapOp(vm)).toThrow(`Stack underflow: 'swap' requires 2 operands (stack: [5])`);
    });
    test('should handle underflow for dup', () => {
      expect(() => dupOp(vm)).toThrow(
        `Stack underflow: 'dup' requires 1 operand (stack: ${JSON.stringify(vm.getStackData())})`,
      );
    });
    test('should handle return stack overflow', () => {
      // Fill return stack to leave exactly one free cell so evalOp's two rpushes overflow
  const available = RSTACK_TOP / CELL_SIZE - vm.rsp; // remaining capacity in cells (public constants)
      for (let i = 0; i < available - 1; i++) {
        vm.rpush(0);
      }

  // Push a CODE reference so evalOp enters the frame-setup path (which rpushes twice)
  vm.push(toTaggedValue(0x1234, Tag.CODE));
  // evalOp will attempt to push return IP and saved BP (relative), overflowing on second push
  expect(() => evalOp(vm)).toThrow(/Return stack \(RSP\) overflow/);
    });
  });
});

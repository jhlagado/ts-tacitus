import { addOp } from '../../../ops/math-ops';
import { dupOp, swapOp } from '../../../core/stack-ops';
import { initializeInterpreter, vm } from '../../../core/globalState';
import { fromTaggedValue, Tag, toTaggedValue } from '../../../core/tagged';
import { toUnsigned16 } from '../../../core/utils';
import { Op } from '../../../ops/opcodes';

import {
  abortOp,
  exitOp,
  evalOp,
  skipDefOp,
  callOp,
  skipBlockOp,
  literalNumberOp,
  groupLeftOp,
  groupRightOp,
} from '../../../ops/builtins-interpreter';
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
      const originalBP = 0x9029;
      vm.rpush(toTaggedValue(testAddress, Tag.CODE));
      vm.rpush(originalBP);
      const currentBP = vm.RP;
      vm.BP = currentBP;
      exitOp(vm);
      expect(vm.IP).toBe(testAddress);
      expect(vm.BP).toBe(originalBP);
    });
    test('evalOp should push IP to return stack, set up BP frame, and jump', () => {
      const testAddress = 0x2345;
      const originalIP = vm.IP;
      const originalBP = vm.BP;
      vm.push(toTaggedValue(testAddress, Tag.CODE));
      evalOp(vm);
      expect(vm.IP).toBe(testAddress);
      expect(vm.BP).toBe(vm.RP);
      const savedBP = vm.rpop();
      expect(savedBP).toBe(originalBP);
      const returnAddr = vm.rpop();
      expect(fromTaggedValue(returnAddr).value).toBe(originalIP);
    });
    test('branchOp should jump relative', () => {
      const initialIP = vm.IP;
      vm.compiler.compile16(10);
      skipDefOp(vm);
      expect(vm.IP).toBe(initialIP + 12);
    });
    test('callOp should jump to absolute address and set up BP frame', () => {
      const originalIP = vm.IP;
      const originalBP = vm.BP;
      const testAddress = 0x12345;
      vm.compiler.compile16(testAddress);
      callOp(vm);
      expect(vm.IP).toBe(toUnsigned16(testAddress));
      expect(vm.BP).toBe(vm.RP);
      const savedBP = vm.rpop();
      expect(savedBP).toBe(originalBP);
      const returnAddr = vm.rpop();
      const { value } = fromTaggedValue(returnAddr);
      expect(value).toBe(originalIP + 2);
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
  describe('Branch Operations', () => {
    test('branchCallOp should jump relative', () => {
      const initialIP = vm.IP;
      vm.compiler.compile16(10);
      skipBlockOp(vm);
      expect(vm.IP).toBe(initialIP + 12);
    });
    test('should handle negative offsets', () => {
      vm.IP = 10;
      vm.compiler.compile16(-10);
      skipBlockOp(vm);
      expect(vm.IP).toBe(12);
    });
    test('should push return address', () => {
      const initialIP = vm.IP;
      skipBlockOp(vm);
      const { value: pointer } = fromTaggedValue(vm.pop());
      expect(pointer).toBe(initialIP + 2);
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
    test('groupLeftOp should push the current SP onto the return stack', () => {
      const initialSP = vm.SP;
      groupLeftOp(vm);
      const savedSP = vm.rpop();
      expect(savedSP).toBe(initialSP);
    });
    test('groupRightOp should compute the number of 4-byte items pushed since group left', () => {
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
      const maxDepth = vm.RP / 4;
      for (let i = 0; i < maxDepth; i++) {
        vm.rpush(0);
      }

      expect(() => evalOp(vm)).toThrow('Stack underflow');
    });
  });
});

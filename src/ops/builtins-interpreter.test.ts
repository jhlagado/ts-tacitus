import { plusOp } from './builtins-math';
import { dupOp, swapOp } from './builtins-stack';
import { initializeInterpreter, vm } from '../core/globalState';
import { fromTaggedValue, Tag, toTaggedValue } from '../core/tagged';
import { toUnsigned16 } from '../core/utils';
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
} from './builtins-interpreter';

describe('Built-in Words', () => {
  beforeEach(() => {
    initializeInterpreter();
  });

  describe('Control Flow Operations', () => {
    it('abortOp should stop execution', () => {
      abortOp(vm);
      expect(vm.running).toBe(false);
    });

    it('exitOp should restore IP from return stack', () => {
      const testAddress = 0x2345;
      vm.rpush(toTaggedValue(testAddress, false, Tag.CODE));
      vm.rpush(vm.BP);
      vm.BP = vm.RP;
      exitOp(vm);
      expect(vm.IP).toBe(testAddress);
    });

    it('evalOp should push IP to return stack and jump', () => {
      const testAddress = 0x2345;
      vm.push(toTaggedValue(testAddress, false, Tag.CODE));
      evalOp(vm);
      expect(vm.IP).toBe(testAddress);
      expect(fromTaggedValue(vm.rpop()).value).toBe(0); // Original IP before eval
    });

    it('branchOp should jump relative', () => {
      const initialIP = vm.IP;
      vm.compiler.compile16(10);
      skipDefOp(vm);
      expect(vm.IP).toBe(initialIP + 12); // +2 for opcode + 2 for offset
    });

    it('callOp should jump to absolute address', () => {
      const originalIP = vm.IP;
      const testAddress = 0x12345;
      vm.compiler.compile16(testAddress);
      callOp(vm);
      expect(vm.IP).toBe(toUnsigned16(testAddress));
      expect(fromTaggedValue(vm.rpop()).value).toBe(originalIP); // Original IP after call
    });
  });

  describe('Branch Operations', () => {
    it('branchCallOp should jump relative', () => {
      const initialIP = vm.IP;
      vm.compiler.compile16(10);
      skipBlockOp(vm);
      expect(vm.IP).toBe(initialIP + 12); // +2 for opcode + 2 for offset
    });

    it('should handle negative offsets', () => {
      vm.IP = 10;
      vm.compiler.compile16(-10);
      skipBlockOp(vm);
      expect(vm.IP).toBe(12);
    });

    it('should push return address', () => {
      const initialIP = vm.IP;
      skipBlockOp(vm);
      const { value: pointer } = fromTaggedValue(vm.pop());
      expect(pointer).toBe(initialIP + 2); // +1 opcode + 2 offset
    });
  });

  describe('Literal Operations', () => {
    it('literalNumberOp should push numbers', () => {
      vm.compiler.compileFloat32(42);
      literalNumberOp(vm);
      expect(vm.pop()).toBe(42);
    });

    it('should handle tagged pointers', () => {
      const addr = toTaggedValue(0x2345, false, Tag.CODE);
      vm.compiler.compileFloat32(addr);
      literalNumberOp(vm);
      expect(vm.pop()).toBe(addr);
    });
  });

  describe('Grouping Operations', () => {
    it('groupLeftOp should push the current SP onto the return stack', () => {
      const initialSP = vm.SP;
      groupLeftOp(vm);
      const savedSP = vm.rpop();
      expect(savedSP).toBe(initialSP);
    });

    it('groupRightOp should compute the number of 4-byte items pushed since group left', () => {
      // Begin group by saving current SP.
      groupLeftOp(vm);
      // Push two numbers (each push advances SP by 4 bytes).
      vm.push(10);
      vm.push(20);
      // Now call groupRightOp; difference = (SP - savedSP)/4 should be 2.
      groupRightOp(vm);
      const count = vm.pop();
      expect(count).toBe(2);
    });
  });

  describe('Error Handling', () => {
    it('should show stack state in errors', () => {
      try {
        plusOp(vm);
      } catch (e) {
        if (e instanceof Error) {
          expect(e.message).toMatch(/stack: \[\]/);
        }
      }
    });

    it('should handle underflow for swap', () => {
      vm.push(5);
      expect(() => swapOp(vm)).toThrow(`Stack underflow: Cannot pop value (stack: [])`);
    });

    it('should handle underflow for dup', () => {
      expect(() => dupOp(vm)).toThrow(
        `Stack underflow: 'dup' requires 1 operand (stack: ${JSON.stringify(vm.getStackData())})`
      );
    });

    it('should handle return stack overflow', () => {
      // Fill return stack.
      const maxDepth = vm.RP / 4;
      for (let i = 0; i < maxDepth; i++) {
        vm.rpush(0);
      }
      expect(() => evalOp(vm)).toThrow('Stack underflow');
    });
  });
});

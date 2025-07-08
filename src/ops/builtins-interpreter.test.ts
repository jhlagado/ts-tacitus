import { addOp } from './builtins-math';
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

    it('exitOp should restore IP from return stack and BP frame', () => {
      const testAddress = 0x2345;
      const originalBP = 0x9029;
      
      // Setup return stack with correct frame structure: [returnAddr, oldBP]
      vm.rpush(toTaggedValue(testAddress, Tag.CODE));
      vm.rpush(originalBP);
      
      // Set current BP to point to the top of the frame
      const currentBP = vm.RP;
      vm.BP = currentBP;
      
      // Execute exitOp which should:
      // 1. Restore RP from BP
      // 2. Pop and restore BP
      // 3. Pop and restore IP
      exitOp(vm);
      
      expect(vm.IP).toBe(testAddress); // IP should be restored
      expect(vm.BP).toBe(originalBP); // BP should be restored
    });

    it('evalOp should push IP to return stack, set up BP frame, and jump', () => {
      const testAddress = 0x2345;
      const originalIP = vm.IP;
      const originalBP = vm.BP;
      
      // Push code address to evaluate
      vm.push(toTaggedValue(testAddress, Tag.CODE));
      
      // Call evalOp
      evalOp(vm);
      
      // Check IP was updated
      expect(vm.IP).toBe(testAddress);
      
      // The return stack should have: [return address, old BP]
      // And BP should point to the new frame
      
      // BP should point to the top of the stack frame
      expect(vm.BP).toBe(vm.RP);
      
      // Pop the saved BP
      const savedBP = vm.rpop();
      expect(savedBP).toBe(originalBP);
      
      // Pop the return address
      const returnAddr = vm.rpop();
      expect(fromTaggedValue(returnAddr).value).toBe(originalIP); // Original IP before eval
    });

    it('branchOp should jump relative', () => {
      const initialIP = vm.IP;
      vm.compiler.compile16(10);
      skipDefOp(vm);
      expect(vm.IP).toBe(initialIP + 12); // +2 for opcode + 2 for offset
    });

    it('callOp should jump to absolute address and set up BP frame', () => {
      const originalIP = vm.IP;
      const originalBP = vm.BP;
      const testAddress = 0x12345;
      
      // Prepare the next16 read
      vm.compiler.compile16(testAddress);
      
      // Call the function
      callOp(vm);
      
      // Check the IP was updated to the target address
      expect(vm.IP).toBe(toUnsigned16(testAddress));
      
      // BP should point to the top of the return stack after pushing frame
      expect(vm.BP).toBe(vm.RP);
      
      // The return stack should have: [return address, old BP]
      // Pop and check the old BP
      const savedBP = vm.rpop();
      expect(savedBP).toBe(originalBP);
      
      // Pop and check the return address
      const returnAddr = vm.rpop();
      const { value } = fromTaggedValue(returnAddr);
      // The implementation adds 2 to the return address to account for the opcode + address
      expect(value).toBe(originalIP + 2); // Original IP + 2 for opcode + address
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
      const addr = toTaggedValue(0x2345, Tag.CODE);
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
        addOp(vm);
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

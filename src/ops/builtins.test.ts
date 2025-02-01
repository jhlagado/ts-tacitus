import {
  abortOp,
  exitOp,
  evalOp,
  skipDefOp,
  callOp,
  skipBlockOp,
  literalNumberOp,
} from "./builtins-interpreter";
import { plusOp, minusOp, multiplyOp, divideOp } from "./builtins-math";
import { dupOp, dropOp, swapOp } from "./builtins-stack";
import { initializeInterpreter, vm } from "../globalState";
import { CODE, RSTACK } from "../memory";
import { Tag, toTagNum } from "../tagnum";
import { toUnsigned16 } from "../utils";

describe("Built-in Words", () => {
  beforeEach(() => {
    initializeInterpreter();
  });

  describe("Arithmetic Operations", () => {
    it("+ should add two numbers", () => {
      vm.push(5);
      vm.push(3);
      plusOp(vm);
      expect(vm.getStackData()).toEqual([8]);
    });

    it("+ should throw on insufficient stack items", () => {
      vm.push(5); // Only one item on the stack
      expect(() => plusOp(vm)).toThrow(
        `Stack underflow: Cannot pop value (stack: [])`
      );
    });

    it("- should subtract numbers", () => {
      vm.push(5);
      vm.push(3);
      minusOp(vm);
      expect(vm.getStackData()).toEqual([2]);
    });

    it("- should throw on insufficient stack items", () => {
      vm.push(5); // Only one item on the stack
      expect(() => minusOp(vm)).toThrow(
        `Stack underflow: Cannot pop value (stack: [])`
      );
    });

    it("* should multiply numbers", () => {
      vm.push(5);
      vm.push(3);
      multiplyOp(vm);
      expect(vm.getStackData()).toEqual([15]);
    });

    it("* should throw on insufficient stack items", () => {
      vm.push(5); // Only one item on the stack
      expect(() => multiplyOp(vm)).toThrow(
        `Stack underflow: Cannot pop value (stack: [])`
      );
    });

    it("/ should divide numbers", () => {
      vm.push(6);
      vm.push(3);
      divideOp(vm);
      expect(vm.getStackData()).toEqual([2]);
    });
  });

  describe("Stack Operations", () => {
    it("dup should duplicate top item", () => {
      vm.push(5);
      dupOp(vm);
      expect(vm.getStackData()).toEqual([5, 5]);
    });

    it("drop should remove top item", () => {
      vm.push(5);
      dropOp(vm);
      expect(vm.getStackData()).toEqual([]);
    });

    it("swap should swap top two items", () => {
      vm.push(5);
      vm.push(3);
      swapOp(vm);
      expect(vm.getStackData()).toEqual([3, 5]);
    });

    it("drop should throw on empty stack", () => {
      expect(() => dropOp(vm)).toThrow(
        `Stack underflow: 'drop' requires 1 operand (stack: ${JSON.stringify(
          vm.getStackData()
        )})`
      );
    });

    it("swap should throw on insufficient stack items", () => {
      vm.push(5);
      expect(() => swapOp(vm)).toThrow(
        `Stack underflow: Cannot pop value (stack: [])`
      );
    });
  });

  describe("Arithmetic Operations", () => {
    it("+ should add two numbers", () => {
      vm.push(5);
      vm.push(3);
      plusOp(vm);
      expect(vm.getStackData()).toEqual([8]);
    });

    it("- should subtract numbers", () => {
      vm.push(5);
      vm.push(3);
      minusOp(vm);
      expect(vm.getStackData()).toEqual([2]);
    });

    it("* should multiply numbers", () => {
      vm.push(5);
      vm.push(3);
      multiplyOp(vm);
      expect(vm.getStackData()).toEqual([15]);
    });

    it("/ should divide numbers", () => {
      vm.push(6);
      vm.push(3);
      divideOp(vm);
      expect(vm.getStackData()).toEqual([2]);
    });
  });

  describe("Stack Operations", () => {
    it("dup should duplicate top item", () => {
      vm.push(5);
      dupOp(vm);
      expect(vm.getStackData()).toEqual([5, 5]);
    });

    it("drop should remove top item", () => {
      vm.push(5);
      dropOp(vm);
      expect(vm.getStackData()).toEqual([]);
    });

    it("swap should swap top two items", () => {
      vm.push(5);
      vm.push(3);
      swapOp(vm);
      expect(vm.getStackData()).toEqual([3, 5]);
    });

    it("drop should throw on empty stack", () => {
      expect(() => dropOp(vm)).toThrow(
        `Stack underflow: 'drop' requires 1 operand (stack: ${JSON.stringify(
          vm.getStackData()
        )})`
      );
    });

    it("swap should throw on insufficient stack items", () => {
      vm.push(5);
      expect(() => swapOp(vm)).toThrow(
        `Stack underflow: Cannot pop value (stack: [])`
      );
    });
  });

  describe("Control Flow Operations", () => {
    it("abortOp should stop execution", () => {
      abortOp(vm);
      expect(vm.running).toBe(false);
    });

    it("exitOp should restore IP from return stack", () => {
      const testAddress = 0x12345;
      vm.rpushAddress(testAddress);
      exitOp(vm);
      expect(vm.IP).toBe(testAddress);
    });

    it("evalOp should push IP to return stack and jump", () => {
      const testAddress = 0x12345;
      vm.pushAddress(testAddress);
      evalOp(vm);
      expect(vm.IP).toBe(testAddress);
      expect(vm.rpopAddress()).toBe(CODE); // Original IP before eval
    });

    it("branchOp should jump relative", () => {
      const initialIP = vm.IP;
      vm.compiler.compile16(10);
      skipDefOp(vm);
      expect(vm.IP).toBe(initialIP + 12); // +2 for opcode + 2 for offset
    });

    it("callOp should jump to absolute address", () => {
      const testAddress = 0x12345;
      vm.compiler.compile16(testAddress);
      callOp(vm);
      expect(vm.IP).toBe(toUnsigned16(testAddress));
      expect(vm.rpopAddress()).toBe(CODE + 2); // Original IP after call
    });
  });

  describe("Branch Operations", () => {
    it("branchCallOp should jump relative", () => {
      const initialIP = vm.IP;
      vm.compiler.compile16(10);
      skipBlockOp(vm);
      expect(vm.IP).toBe(initialIP + 12); // +2 for opcode + 2 for offset
    });

    it("should handle negative offsets", () => {
      vm.IP = CODE + 10;
      vm.compiler.compile16(-10);
      skipBlockOp(vm);
      expect(vm.IP).toBe(CODE + 12);
    });

    it("should push return address", () => {
      const initialIP = vm.IP;
      skipBlockOp(vm);
      expect(vm.popAddress()).toBe(initialIP + 2); // +1 opcode + 2 offset
    });
  });

  describe("Literal Operations", () => {
    it("literalNumberOp should push numbers", () => {
      vm.compiler.compileFloat(42);
      literalNumberOp(vm);
      expect(vm.pop()).toBe(42);
    });

    it("should handle tagged pointers", () => {
      const addr = toTagNum(Tag.ADDRESS, 0x12345);
      vm.compiler.compileFloat(addr);
      literalNumberOp(vm);
      expect(vm.pop()).toBe(addr);
    });
  });

  describe("Error Handling", () => {
    it("should show stack state in errors", () => {
      try {
        plusOp(vm);
      } catch (e) {
        if (e instanceof Error) {
          expect(e.message).toMatch(/stack: \[\]/);
        }
      }
    });

    it("should handle underflow for swap", () => {
      vm.push(5);
      expect(() => swapOp(vm)).toThrow(
        `Stack underflow: Cannot pop value (stack: [])`
      );
    });

    it("should handle underflow for dup", () => {
      expect(() => dupOp(vm)).toThrow(
        `Stack underflow: 'dup' requires 1 operand (stack: ${JSON.stringify(
          vm.getStackData()
        )})`
      );
    });

    it("should handle return stack overflow", () => {
      // Fill return stack
      const maxDepth = (vm.RP - RSTACK) / 4;
      for (let i = 0; i < maxDepth; i++) {
        vm.rpush(0);
      }
      expect(() => evalOp(vm)).toThrow("Stack underflow");
    });
  });

  describe("Debug Mode", () => {
    let consoleSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleSpy = jest.spyOn(console, "log").mockImplementation();
      vm.debug = true;
    });

    afterEach(() => {
      consoleSpy.mockRestore();
      vm.debug = false;
    });

    it("should log literal operations", () => {
      vm.compiler.compileFloat(42);
      literalNumberOp(vm);
      expect(consoleSpy).toHaveBeenCalledWith("literalNumberOp", 42);
    });

    it("should log branchCallOp", () => {
      vm.compiler.compile16(10);
      skipBlockOp(vm);
      expect(consoleSpy).toHaveBeenCalledWith("branchCallOp", 10);
    });
  });
});

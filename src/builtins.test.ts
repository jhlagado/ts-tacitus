import { initializeInterpreter, vm } from "./globalState";
import {
  abortOp,
  branchCallOp,
  divideOp,
  dropOp,
  dupOp,
  evalOp,
  exitOp,
  literalNumberOp,
  minusOp,
  multiplyOp,
  plusOp,
  swapOp,
} from "./builtins";
import { CODE, RSTACK } from "./memory";
import { TAG, toTaggedPtr } from "./tagged-ptr";

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
  });

  describe("Branch Operations", () => {
    it("branchCallOp should jump relative", () => {
      const initialIP = vm.IP;
      vm.compiler.compile16(10);
      branchCallOp(vm);
      expect(vm.IP).toBe(initialIP + 12); // +3 for opcode + offset
    });

    it("should handle negative offsets", () => {
      vm.IP = CODE + 10;
      vm.compiler.compile16(-10);
      branchCallOp(vm);
      expect(vm.IP).toBe(CODE + 12);
    });

    it("should push return address", () => {
      const initialIP = vm.IP;
      branchCallOp(vm);
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
      const addr = toTaggedPtr(TAG.ADDRESS, 0x12345);
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
        "Stack underflow: Cannot pop value (stack: [])"
      );
    });

    it("should handle underflow for dup", () => {
      expect(() => dupOp(vm)).toThrow("dup' requires 1 operand");
    });

    it("should handle return stack overflow", () => {
      // Fill return stack
      const maxDepth = (vm.RP - RSTACK) / 4;
      for (let i = 0; i < maxDepth; i++) {
        vm.rpush(0);
      }
      expect(() => evalOp(vm)).toThrow(
        "Stack underflow: Cannot pop value (stack: [])"
      );
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
  });
});

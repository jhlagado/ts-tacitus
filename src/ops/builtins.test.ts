import { addOp, subtractOp, multiplyOp, divideOp } from "./builtins-math";
import { dupOp, dropOp, swapOp } from "./builtins-stack";
import { initializeInterpreter, vm } from "../core/globalState";

describe("Built-in Words", () => {
  beforeEach(() => {
    initializeInterpreter();
  });

  describe("Arithmetic Operations", () => {
    it("add should add two numbers", () => {
      vm.push(5);
      vm.push(3);
      addOp(vm);
      expect(vm.getStackData()).toEqual([8]);
    });

    it("add should throw on insufficient stack items", () => {
      vm.push(5); // Only one item on the stack
      expect(() => addOp(vm)).toThrow(
        `Stack underflow: Cannot pop value (stack: [])`
      );
    });

    it("sub should subtract numbers", () => {
      vm.push(5);
      vm.push(3);
      subtractOp(vm);
      expect(vm.getStackData()).toEqual([2]);
    });

    it("sub should throw on insufficient stack items", () => {
      vm.push(5); // Only one item on the stack
      expect(() => subtractOp(vm)).toThrow(
        `Stack underflow: Cannot pop value (stack: [])`
      );
    });

    it("mul should multiply numbers", () => {
      vm.push(5);
      vm.push(3);
      multiplyOp(vm);
      expect(vm.getStackData()).toEqual([15]);
    });

    it("mul should throw on insufficient stack items", () => {
      vm.push(5); // Only one item on the stack
      expect(() => multiplyOp(vm)).toThrow(
        `Stack underflow: Cannot pop value (stack: [])`
      );
    });

    it("div should divide numbers", () => {
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
    it("add should add two numbers", () => {
      vm.push(5);
      vm.push(3);
      addOp(vm);
      expect(vm.getStackData()).toEqual([8]);
    });

    it("sub should subtract numbers", () => {
      vm.push(5);
      vm.push(3);
      subtractOp(vm);
      expect(vm.getStackData()).toEqual([2]);
    });

    it("mul should multiply numbers", () => {
      vm.push(5);
      vm.push(3);
      multiplyOp(vm);
      expect(vm.getStackData()).toEqual([15]);
    });

    it("div should divide numbers", () => {
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

});

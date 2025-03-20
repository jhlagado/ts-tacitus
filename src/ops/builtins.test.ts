import { plusOp, minusOp, multiplyOp, divideOp } from "./builtins-math";
import { dupOp, dropOp, swapOp } from "./builtins-stack";
import { initializeInterpreter, vm } from "../core/globalState";

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

});

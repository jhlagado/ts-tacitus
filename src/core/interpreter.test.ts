import { execute } from "../core/interpreter";
import { parse } from "../core/parser";
import { Tokenizer } from "./tokenizer";
import { vm, initializeInterpreter } from "./globalState";
import * as math from "../ops/builtins-math";
import { Op } from "../ops/builtins";

describe("Interpreter", () => {
  beforeEach(() => {
    initializeInterpreter();
    vm.debug = true;
  });

  describe("Basic operations", () => {
    it("should execute simple addition", () => {
      executeProgram("5 3 +");
      expectStack([8]);
    });

    it("should handle subtraction", () => {
      executeProgram("10 3 -");
      expectStack([7]);
    });

    it("should handle multiplication", () => {
      executeProgram("5 3 *");
      expectStack([15]);
    });

    it("should handle division", () => {
      executeProgram("15 3 /");
      expectStack([5]);
    });
  });

  // Stack manipulation
  describe("Stack operations", () => {
    it("should handle dup", () => {
      executeProgram("5 dup");
      expectStack([5, 5]);
    });

    it("should handle drop", () => {
      executeProgram("5 3 drop");
      expectStack([5]);
    });

    it("should handle swap", () => {
      executeProgram("5 3 swap");
      expectStack([3, 5]);
    });

    it("should handle complex stack operations", () => {
      executeProgram("1 2 3 drop swap dup");
      expectStack([2, 1, 1]);
    });
  });

  describe("Control flow", () => {
    it("should handle empty program", () => {
      executeProgram("");
      expectStack([]);
    });
  });

  describe("Code blocks", () => {
    it("should execute simple code block", () => {
      executeProgram("(30 20 *) eval");
      expectStack([600]);
    });

    it("should execute nested code blocks", () => {
      executeProgram("((4 2 +)eval (3 2 +)eval *)eval 2 +");
      expectStack([32]);
    });

    it("should handle code blocks with stack operations", () => {
      executeProgram("4(3 2 *)eval +");
      expectStack([10]);
    });

    it("should handle multiple nested evals", () => {
      executeProgram("(1 (3 4 swap) eval 2) eval");
      expectStack([1, 4, 3, 2]);
    });
  });

  // Error handling
  describe("Error handling", () => {
    it("should handle invalid opcodes", () => {
      vm.compiler.compile8(255); // Invalid opcode
      expect(() => execute(vm.compiler.BP)).toThrow("Invalid opcode: 255");
    });

    it("should handle non-Error exceptions", () => {
      jest.spyOn(math, "plusOp").mockImplementation(() => {
        throw "Raw string error";
      });
      expect(() => executeProgram("5 3 +")).toThrow(
        "Error executing word (stack: [5,3])"
      );
      jest.restoreAllMocks();
    });

    it("should preserve stack state on error", () => {
      try {
        executeProgram("5 3 0 / +");
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (e) {
        expect(vm.getStackData()).toEqual([5, 3, 0]);
      }
    });

    it("should skip definition body during normal execution", () => {
      executeProgram(`
        : double 2 * ;
        5 double
      `);
      expectStack([10]);
    });
  });

  // Memory management
  describe("Memory management", () => {
    it("should preserve memory when flag is set", () => {
      vm.compiler.preserve = true;
      executeProgram("5 3 +");
      expect(vm.compiler.BP).toBe(vm.compiler.CP);
      expect(vm.compiler.preserve).toBe(false);
    });

    it("should reset memory when preserve is false", () => {
      const initialBP = vm.compiler.BP;
      executeProgram("5 3 +");
      expect(vm.compiler.CP).toBe(initialBP);
    });

    it("should handle multiple preserve states", () => {
      // First execution with preserve=false
      executeProgram("5 3 +");
      const initialBP = vm.compiler.BP;

      // Second execution with preserve=true
      vm.compiler.preserve = true;
      executeProgram("2 2 +");
      expect(vm.compiler.BP).toBe(initialBP + 12);
    });
  });

  // Debugging and special modes
  describe("Debugging", () => {
    it("should log debug output when enabled", () => {
      const consoleSpy = jest.spyOn(console, "log").mockImplementation();
      vm.debug = true;

      executeProgram("5 3 +");
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.objectContaining({ opcode: Op.LiteralNumber }),
        expect.any(Number)
      );

      consoleSpy.mockRestore();
      vm.debug = false;
    });
  });

  describe("Colon definitions", () => {
    it("should execute simple colon definition", () => {
      executeProgram(`: square dup * ; 
      3 square`);
      expectStack([9]);
    });

    it("should handle multiple colon definitions", () => {
      executeProgram(`
        : square dup * ;
        : cube dup square * ;
        4 square
        3 cube
      `);
      expectStack([16, 27]);
    });

    it("should allow colon definitions to use other definitions", () => {
      executeProgram(`
        : double 2 * ;
        : quadruple double double ;
        5 quadruple
      `);
      expectStack([20]);
    });

    it("should handle colon definitions with stack manipulation", () => {
      executeProgram(`
        : swap-and-add swap + ;
        3 7 swap-and-add
      `);
      expectStack([10]);
    });

    it("should handle colon definitions with code blocks", () => {
      executeProgram(`
        : apply-block swap eval ;
        (2 *) 5 apply-block
      `);
      expectStack([10]);
    });
  });

  // Helper functions
  function executeProgram(code: string): void {
    parse(new Tokenizer(code));
    execute(vm.compiler.BP);
  }

  function expectStack(expected: number[]): void {
    expect(vm.getStackData()).toEqual(expected);
  }
});

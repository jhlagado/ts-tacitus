import { execute } from "../core/interpreter";
import { parse } from "../core/parser";
import { Tokenizer } from "../core/tokenizer";
import { vm, initializeInterpreter } from "../core/globalState";
import * as math from "../ops/builtins-math";
import { Op } from "../ops/builtins";
import { vectorCreate, vectorGet } from "../heap/vector";
import { CoreTag, fromTaggedValue, HeapTag } from "../core/tagged";

// Helper functions
function executeProgram(code: string): void {
  parse(new Tokenizer(code));
  execute(vm.compiler.BP);
}

function expectStack(expected: number[]): void {
  expect(vm.getStackData()).toEqual(expected);
}

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
});

describe("Interpreter Vectors", () => {
  beforeEach(() => {
    initializeInterpreter();
  });

  it("should compile and execute vector literal [ 1 2 3 ]", () => {
    // Compile and execute the vector literal.
    parse(new Tokenizer("[ 1 2 3 ]"));
    execute(vm.compiler.BP);

    // The expectation is that the vector literal leaves a tagged pointer on the stack.
    const stackData = vm.getStackData();
    expect(stackData.length).toBe(1);

    const vectorPtr = stackData[0];

    // Using fromTaggedValue to extract the underlying block reference;
    // then use vectorGet to check each element.
    const { value: firstBlock } = fromTaggedValue(vectorPtr);
    // Optionally, you could verify that firstBlock is a valid block.
    expect(firstBlock).not.toBeUndefined();

    expect(vectorGet(vm.heap, vectorPtr, 0)).toBeCloseTo(1);
    expect(vectorGet(vm.heap, vectorPtr, 1)).toBeCloseTo(2);
    expect(vectorGet(vm.heap, vectorPtr, 2)).toBeCloseTo(3);
  });

  it("should print vector literal when using '.'", () => {
    const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    // Execute a program that compiles a vector literal then prints it.
    // The code [ 1 2 3 ] . should leave a vector on the stack and then print it.
    executeProgram("[ 1 2 3 ] .");

    // Adjust the expected string if your vector-printing format changes.
    expect(consoleSpy).toHaveBeenCalledWith("[ 1 2 3 ]");
    consoleSpy.mockRestore();
  });

  xit("should compile and execute nested vector literal [ 1 2 [ 3 ] ]", () => {
    const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    // Execute a program that compiles a nested vector literal then prints it.
    // The code [ 1 2 [ 3 ] ] . should leave an outer vector whose third element
    // is itself a vector, and then print the nested structure.
    executeProgram("[ 1 2 [ 3 ] ] .");

    // Example expected output string. Adjust this string to match your vector printing format.
    expect(consoleSpy).toHaveBeenCalledWith("[ 1 2 [ 3 ] ]");
    consoleSpy.mockRestore();
  });

  it("should preserve nested vector references when stored and retrieved", () => {
    // Create an inner vector
    const innerVecPtr = vectorCreate(vm.heap, [3, 4]);

    // Verify the inner vector is valid and properly tagged
    const innerType = fromTaggedValue(innerVecPtr);
    console.log("Inner vector tag type:", innerType.tag);

    // Store the inner vector in an outer vector
    const outerVecPtr = vectorCreate(vm.heap, [1, 2, innerVecPtr]);

    // Retrieve the inner vector reference directly
    const retrievedInnerPtr = vectorGet(vm.heap, outerVecPtr, 2);

    console.log("Original inner vector ptr:", innerVecPtr);
    console.log("Retrieved inner vector ptr:", retrievedInnerPtr);

    // Check if we can access elements of the retrieved inner vector
    // This would fail if the tag information was lost
    const element0 = vectorGet(vm.heap, retrievedInnerPtr, 0);
    const element1 = vectorGet(vm.heap, retrievedInnerPtr, 1);

    console.log("Inner vector elements:", element0, element1);

    expect(element0).toBe(3);
    expect(element1).toBe(4);
  });

  it('should compile and execute vector literal [ 1 "2" 3 ]', () => {
    // Compile and execute the vector literal.
    parse(new Tokenizer('1 "2" [ 3 ]'));
    execute(vm.compiler.BP);
    // const stackData = vm.getStackData();
    const stackData = vm.popArray(3);
    const item1 = stackData[0];
    const item2 = stackData[1];
    const item3 = stackData[2];

    const { value: value1, heap: heap1, tag: tag1 } = fromTaggedValue(item1);
    const { value: _value2, heap: heap2, tag: tag2 } = fromTaggedValue(item2);
    const { value: _value3, heap: heap3, tag: tag3 } = fromTaggedValue(item3);

    expect(value1).toBeCloseTo(1, 1);
    expect(heap1).toBe(false);
    expect(tag1).toBe(CoreTag.NUMBER);

    expect(heap2).toBe(false);
    expect(tag2).toBe(CoreTag.STRING);

    expect(heap3).toBe(true);
    expect(tag3).toBe(HeapTag.VECTOR);

    const vecitem1 = vectorGet(vm.heap, item3, 0);
    const { value: value4, heap: heap4, tag: tag4 } = fromTaggedValue(vecitem1);
    expect(value4).toBeCloseTo(3, 1);
    expect(heap4).toBe(false);
    expect(tag4).toBe(CoreTag.NUMBER);
  });
});

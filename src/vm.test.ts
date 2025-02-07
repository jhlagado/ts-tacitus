import { VM } from "./vm";
import { STACK_SIZE, RSTACK_SIZE, CODE } from "./memory";
import { Compiler } from "./lang/compiler";
import { Dictionary } from "./lang/dictionary";
import { fromTaggedValue, Tag, toTaggedValue } from "./tagged-value";

describe("VM", () => {
  let vm: VM;

  beforeEach(() => {
    vm = new VM();
  });

  // Test 1: Stack operations
  describe("Stack operations", () => {
    it("should push and pop 20-bit values from the stack", () => {
      vm.push(toTaggedValue(Tag.INTEGER, 0x12345));
      vm.push(toTaggedValue(Tag.INTEGER, 0x5abcd));
      const { value: p1 } = fromTaggedValue(Tag.INTEGER, vm.pop());
      const { value: p2 } = fromTaggedValue(Tag.INTEGER, vm.pop());
      expect(p1).toBe(0x5abcd);
      expect(p2).toBe(0x12345);
    });

    it("should push and pop 32-bit floats from the stack", () => {
      vm.push(3.14);
      vm.push(-123.456);
      expect(vm.pop()).toBeCloseTo(-123.456);
      expect(vm.pop()).toBeCloseTo(3.14);
    });

    it("should throw an error on stack overflow", () => {
      for (let i = 0; i < STACK_SIZE / 4; i++) {
        vm.push(i);
      }
      expect(() => vm.push(42)).toThrow("Stack overflow");
    });

    it("should throw an error on stack underflow", () => {
      expect(() => vm.pop()).toThrow("Stack underflow");
    });

    it("should return the correct stack data", () => {
      vm.push(1);
      vm.push(2);
      vm.push(3);
      expect(vm.getStackData()).toEqual([1, 2, 3]);
    });

    it("should handle address tagging", () => {
      vm.push(toTaggedValue(Tag.CODE, 0x12345));
      const { value: pointer } = fromTaggedValue(Tag.CODE, vm.pop());
      expect(pointer).toBe(0x12345);
    });

    it("should throw when popping address from non-address value", () => {
      vm.push(toTaggedValue(Tag.INTEGER, 0x12345));
      expect(() => {
        fromTaggedValue(Tag.CODE, vm.pop());
      }).toThrow("Expected tag CODE, got tag INTEGER");
    });

    it("should throw when popping integer from non-integer value", () => {
      vm.push(toTaggedValue(Tag.CODE, 0x12345));
      expect(() => fromTaggedValue(Tag.INTEGER, vm.pop())).toThrow(
        "Expected tag INTEGER, got tag CODE"
      );
    });
  });

  // Test 2: Return stack operations
  describe("Return stack operations", () => {
    it("should push and pop 20-bit values from the return stack", () => {
      vm.rpush(100);
      vm.rpush(200);
      expect(vm.rpop()).toBe(200);
      expect(vm.rpop()).toBe(100);
    });

    it("should throw an error on return stack overflow", () => {
      for (let i = 0; i < RSTACK_SIZE / 4; i++) {
        vm.rpush(i);
      }
      expect(() => vm.rpush(42)).toThrow("Return stack overflow");
    });

    it("should throw an error on return stack underflow", () => {
      expect(() => vm.rpop()).toThrow("Return stack underflow");
    });

    it("should handle address tagging on return stack", () => {
      vm.rpush(toTaggedValue(Tag.CODE, 0x54321));
      expect(fromTaggedValue(Tag.CODE, vm.rpop()).value).toBe(0x54321);
    });

    it("should handle integer tagging on return stack", () => {
      vm.rpush(toTaggedValue(Tag.INTEGER, 0x12345));
      expect(fromTaggedValue(Tag.INTEGER, vm.rpop()).value).toBe(0x12345);
    });

    it("should throw when popping address from non-address on return stack", () => {
      vm.rpush(toTaggedValue(Tag.INTEGER, 0x12345));
      expect(() => fromTaggedValue(Tag.CODE, vm.rpop())).toThrow(
        "Expected tag CODE, got tag INTEGER"
      );
    });

    it("should throw when popping integer from non-integer on return stack", () => {
      vm.rpush(toTaggedValue(Tag.CODE, 0x12345));
      expect(() => fromTaggedValue(Tag.INTEGER, vm.rpop())).toThrow(
        "Expected tag INTEGER, got tag CODE"
      );
    });
  });

  // Test 3: Instruction pointer operations
  describe("Instruction pointer operations", () => {
    it("should read values from memory using the instruction pointer", () => {
      vm.compiler.compile16(5);
      vm.compiler.compile16(10);
      vm.compiler.compile16(15);

      expect(vm.next16()).toBe(5);
      expect(vm.next16()).toBe(10);
      expect(vm.next16()).toBe(15);
    });

    it("should increment the instruction pointer after reading", () => {
      vm.compiler.compile16(42);
      vm.next16();
      expect(vm.IP).toBe(CODE + 2);
    });

    it("should handle nextAddress correctly", () => {
      const addr = 0x12345;
      vm.compiler.compileFloat(toTaggedValue(Tag.CODE, addr));
      vm.IP = CODE;
      expect(vm.nextAddress()).toBe(addr);
    });

    it("should handle nextInteger correctly", () => {
      const value = 0x54321;
      vm.compiler.compileFloat(toTaggedValue(Tag.INTEGER, value));
      vm.IP = CODE;
      expect(vm.nextInteger()).toBe(value);
    });

    it("should throw on nextAddress with non-address tag", () => {
      vm.compiler.compileFloat(toTaggedValue(Tag.INTEGER, 0x12345));
      vm.IP = CODE;
      expect(() => vm.nextAddress()).toThrow(
        "Expected tag CODE, got tag INTEGER"
      );
    });

    it("should throw on nextInteger with non-integer tag", () => {
      vm.compiler.compileFloat(toTaggedValue(Tag.CODE, 0x12345));
      vm.IP = CODE;
      expect(() => vm.nextInteger()).toThrow(
        "Expected tag INTEGER, got tag CODE"
      );
    });
  });

  // Test 4: Compiler and dictionary initialization
  describe("Compiler and dictionary initialization", () => {
    it("should initialize the compiler with the VM instance", () => {
      expect(vm.compiler).toBeDefined();
      expect(vm.compiler instanceof Compiler).toBe(true);
    });

    it("should initialize the dictionary", () => {
      expect(vm.dictionary).toBeDefined();
      expect(vm.dictionary instanceof Dictionary).toBe(true);
    });

    it("should return compiled data with getCompileData", () => {
      vm.compiler.compile8(0x12);
      vm.compiler.compile8(0x34);
      vm.compiler.compile8(0x56);
      expect(vm.getCompileData()).toEqual([0x12, 0x34, 0x56]);
    });
  });
});

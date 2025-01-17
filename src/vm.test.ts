import { VM } from "./vm";
import { STACK_SIZE, RSTACK_SIZE, CODE } from "./memory";
import { Compiler } from "./compiler";
import { Dictionary } from "./dictionary";

describe("VM", () => {
  let vm: VM;

  beforeEach(() => {
    vm = new VM(); // Initialize a fresh VM instance before each test
  });

  // Test 1: Stack operations
  describe("Stack operations", () => {
    it("should push and pop 32-bit values from the stack", () => {
      vm.push(0x12345678);
      vm.push(0x9abcdef0);
      expect(vm.pop()).toBe(0x9abcdef0);
      expect(vm.pop()).toBe(0x12345678);
    });

    it("should push and pop 32-bit floats from the stack", () => {
      vm.pushFloat(3.14);
      vm.pushFloat(-123.456);
      expect(vm.popFloat()).toBeCloseTo(-123.456);
      expect(vm.popFloat()).toBeCloseTo(3.14);
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
  });

  // Test 2: Return stack operations
  describe("Return stack operations", () => {
    it("should push and pop 32-bit values from the return stack", () => {
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
  });

  // Test 3: Instruction pointer operations
  describe("Instruction pointer operations", () => {
    it("should read values from memory using the instruction pointer", () => {
      vm.compiler.compile32(5);
      vm.compiler.compile32(10);
      vm.compiler.compile32(15);

      expect(vm.next32()).toBe(5);
      expect(vm.next32()).toBe(10);
      expect(vm.next32()).toBe(15);
    });

    it("should increment the instruction pointer after reading", () => {
      vm.compiler.compile32(42);
      vm.next32();
      expect(vm.IP).toBe(CODE + 4);
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
  });
});

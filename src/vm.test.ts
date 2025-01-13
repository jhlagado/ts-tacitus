// src/vm.test.ts
import { VM } from "./vm";
import { STACK_SIZE, RSTACK_SIZE, TIB } from "./constants";
import { Compiler } from "./compiler";
import { Dictionary } from "./dictionary";

describe("VM", () => {
  let vm: VM;

  beforeEach(() => {
    vm = new VM(); // Initialize a fresh VM instance before each test
  });

  // Test 1: Stack operations
  describe("Stack operations", () => {
    it("should push and pop values from the stack", () => {
      vm.push(5);
      vm.push(10);
      expect(vm.pop()).toBe(10);
      expect(vm.pop()).toBe(5);
    });

    it("should throw an error on stack overflow", () => {
      for (let i = 0; i < STACK_SIZE; i++) {
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
    it("should push and pop values from the return stack", () => {
      vm.rpush(100);
      vm.rpush(200);
      expect(vm.rpop()).toBe(200);
      expect(vm.rpop()).toBe(100);
    });

    it("should throw an error on return stack overflow", () => {
      for (let i = 0; i < RSTACK_SIZE; i++) {
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
      vm.mem.data[TIB] = 5;
      vm.mem.data[TIB + 1] = 10;
      vm.mem.data[TIB + 2] = 15;

      expect(vm.next()).toBe(5);
      expect(vm.next()).toBe(10);
      expect(vm.next()).toBe(15);
    });

    it("should increment the instruction pointer after reading", () => {
      vm.mem.data[TIB] = 42;
      vm.next();
      expect(vm.IP).toBe(TIB + 1);
    });
  });

  // Test 4: Memory initialization
  describe("Memory initialization", () => {
    it("should initialize memory with zeros", () => {
      expect(vm.mem.data.length).toBeGreaterThan(0);
      expect(vm.mem.data.every((value) => value === 0)).toBe(true);
    });
  });

  // Test 5: Compiler and dictionary initialization
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

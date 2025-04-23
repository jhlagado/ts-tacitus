import { VM } from './vm';
import { STACK_SIZE, RSTACK_SIZE } from './memory';
import { Compiler } from '../lang/compiler';
import { SymbolTable } from '../strings/symbol-table';
import { fromTaggedValue, toTaggedValue, CoreTag } from './tagged';

describe('VM', () => {
  let vm: VM;

  beforeEach(() => {
    vm = new VM();
  });

  // Test 1: Stack operations
  describe('Stack operations', () => {
    it('should push and pop 20-bit values from the stack', () => {
      vm.push(1.2);
      vm.push(2.4);
      expect(vm.pop()).toBeCloseTo(2.4);
      expect(vm.pop()).toBeCloseTo(1.2);
    });

    it('should push and pop 32-bit floats from the stack', () => {
      vm.push(3.14);
      vm.push(-123.456);
      expect(vm.pop()).toBeCloseTo(-123.456);
      expect(vm.pop()).toBeCloseTo(3.14);
    });

    it('should throw an error on stack overflow', () => {
      for (let i = 0; i < STACK_SIZE / 4; i++) {
        vm.push(i);
      }
      expect(() => vm.push(42)).toThrow('Stack overflow');
    });

    it('should throw an error on stack underflow', () => {
      expect(() => vm.pop()).toThrow('Stack underflow');
    });

    it('should return the correct stack data', () => {
      vm.push(1);
      vm.push(2);
      vm.push(3);
      expect(vm.getStackData()).toEqual([1, 2, 3]);
    });

    it('should handle address tagging', () => {
      vm.push(toTaggedValue(0x2345, false, CoreTag.CODE));
      const { value, isHeap: heap, tag } = fromTaggedValue(vm.pop());
      expect(value).toBe(0x2345);
      expect(heap).toBe(false);
      expect(tag).toBe(CoreTag.CODE);
    });
  });

  // Test 2: Return stack operations
  describe('Return stack operations', () => {
    it('should push and pop 20-bit values from the return stack', () => {
      vm.rpush(100);
      vm.rpush(200);
      expect(vm.rpop()).toBe(200);
      expect(vm.rpop()).toBe(100);
    });

    it('should throw an error on return stack overflow', () => {
      for (let i = 0; i < RSTACK_SIZE / 4; i++) {
        vm.rpush(i);
      }
      expect(() => vm.rpush(42)).toThrow('Return stack overflow');
    });

    it('should throw an error on return stack underflow', () => {
      expect(() => vm.rpop()).toThrow('Return stack underflow');
    });

    it('should handle address tagging on return stack', () => {
      vm.rpush(toTaggedValue(0x4321, false, CoreTag.CODE));
      const { value, tag } = fromTaggedValue(vm.rpop());
      expect(tag).toBe(CoreTag.CODE);
      expect(value).toBe(0x4321);
    });

    it('should handle integer tagging on return stack', () => {
      vm.rpush(0x2345);
      expect(vm.rpop()).toBe(0x2345);
    });
  });

  // Test 3: Instruction pointer operations
  describe('Instruction pointer operations', () => {
    it('should read values from memory using the instruction pointer', () => {
      vm.compiler.compile16(5);
      vm.compiler.compile16(10);
      vm.compiler.compile16(15);

      expect(vm.next16()).toBe(5);
      expect(vm.next16()).toBe(10);
      expect(vm.next16()).toBe(15);
    });

    it('should increment the instruction pointer after reading', () => {
      vm.compiler.compile16(42);
      vm.next16();
      expect(vm.IP).toBe(2);
    });

    it('should handle nextAddress correctly', () => {
      const addr = 0x2345;
      vm.compiler.compileFloat32(toTaggedValue(addr, false, CoreTag.CODE));
      vm.IP = 0;
      expect(vm.nextAddress()).toBe(addr);
    });
  });

  // Test 4: Compiler and symbolTable initialization
  describe('Compiler and symbolTable initialization', () => {
    it('should initialize the compiler with the VM instance', () => {
      expect(vm.compiler).toBeDefined();
      expect(vm.compiler instanceof Compiler).toBe(true);
    });

    it('should initialize the symbolTable', () => {
      expect(vm.symbolTable).toBeDefined();
      expect(vm.symbolTable instanceof SymbolTable).toBe(true);
    });

    it('should return compiled data with getCompileData', () => {
      vm.compiler.compile8(0x12);
      vm.compiler.compile8(0x34);
      vm.compiler.compile8(0x56);
      expect(vm.getCompileData()).toEqual([0x12, 0x34, 0x56]);
    });
  });
});

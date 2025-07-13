import { VM } from '../../core/vm';
import { STACK_SIZE, RSTACK_SIZE } from '../../core/memory';
import { Compiler } from '../../lang/compiler';
import { SymbolTable } from '../../strings/symbol-table';
import { fromTaggedValue, toTaggedValue, Tag } from '../../core/tagged';

describe('VM', () => {
  let vm: VM;
  beforeEach(() => {
    vm = new VM();
    const compiler = new Compiler(vm);
    vm.initializeCompiler(compiler);
  });

  describe('Stack operations', () => {
    test('should push and pop 20-bit values from the stack', () => {
      vm.push(1.2);
      vm.push(2.4);
      expect(vm.pop()).toBeCloseTo(2.4);
      expect(vm.pop()).toBeCloseTo(1.2);
    });
    test('should push and pop 32-bit floats from the stack', () => {
      vm.push(3.14);
      vm.push(-123.456);
      expect(vm.pop()).toBeCloseTo(-123.456);
      expect(vm.pop()).toBeCloseTo(3.14);
    });
    test('should throw an error on stack overflow', () => {
      for (let i = 0; i < STACK_SIZE / 4; i++) {
        vm.push(i);
      }

      expect(() => vm.push(42)).toThrow('Stack overflow');
    });
    test('should throw an error on stack underflow', () => {
      expect(() => vm.pop()).toThrow('Stack underflow');
    });
    test('should return the correct stack data', () => {
      vm.push(1);
      vm.push(2);
      vm.push(3);
      expect(vm.getStackData()).toEqual([1, 2, 3]);
    });
    test('should handle address tagging', () => {
      vm.push(toTaggedValue(0x2345, Tag.CODE));
      const { value, tag } = fromTaggedValue(vm.pop());
      expect(value).toBe(0x2345);
      expect(tag).toBe(Tag.CODE);
    });
  });

  describe('Return stack operations', () => {
    test('should push and pop 20-bit values from the return stack', () => {
      vm.rpush(100);
      vm.rpush(200);
      expect(vm.rpop()).toBe(200);
      expect(vm.rpop()).toBe(100);
    });
    test('should throw an error on return stack overflow', () => {
      for (let i = 0; i < RSTACK_SIZE / 4; i++) {
        vm.rpush(i);
      }

      expect(() => vm.rpush(42)).toThrow('Return stack overflow');
    });
    test('should throw an error on return stack underflow', () => {
      expect(() => vm.rpop()).toThrow('Return stack underflow');
    });
    test('should handle address tagging on return stack', () => {
      vm.rpush(toTaggedValue(0x4321, Tag.CODE));
      const { value, tag } = fromTaggedValue(vm.rpop());
      expect(tag).toBe(Tag.CODE);
      expect(value).toBe(0x4321);
    });
    test('should handle integer tagging on return stack', () => {
      vm.rpush(0x2345);
      expect(vm.rpop()).toBe(0x2345);
    });
  });

  describe('Instruction pointer operations', () => {
    test('should read values from memory using the instruction pointer', () => {
      vm.compiler.compile16(5);
      vm.compiler.compile16(10);
      vm.compiler.compile16(15);
      expect(vm.next16()).toBe(5);
      expect(vm.next16()).toBe(10);
      expect(vm.next16()).toBe(15);
    });
    test('should increment the instruction pointer after reading', () => {
      vm.compiler.compile16(42);
      vm.next16();
      expect(vm.IP).toBe(2);
    });
    test('should handle nextAddress correctly', () => {
      const addr = 0x2345;
      vm.compiler.compileFloat32(toTaggedValue(addr, Tag.CODE));
      vm.IP = 0;
      expect(vm.nextAddress()).toBe(addr);
    });
  });

  describe('Compiler and symbolTable initialization', () => {
    test('should initialize the compiler with the VM instance', () => {
      expect(vm.compiler).toBeDefined();
      expect(vm.compiler instanceof Compiler).toBe(true);
    });
    test('should initialize the symbolTable', () => {
      expect(vm.symbolTable).toBeDefined();
      expect(vm.symbolTable instanceof SymbolTable).toBe(true);
    });
    test('should return compiled data with getCompileData', () => {
      vm.compiler.compile8(0x12);
      vm.compiler.compile8(0x34);
      vm.compiler.compile8(0x56);
      expect(vm.getCompileData()).toEqual([0x12, 0x34, 0x56]);
    });
  });
});

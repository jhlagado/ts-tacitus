import { VM, STACK_SIZE_BYTES, RSTACK_SIZE_BYTES, SEG_CODE, createVM } from '../../core';
import { encodeX1516 } from '../../core/code-ref';
import {
  nextAddress,
  nextInt16,
  push,
  pop,
  getStackData,
  rpush,
  rpop,
  emitUint16,
  emitTaggedAddress,
  emitOpcode,
} from '../../core/vm';
// Symbol table is now a function-based facade; verify presence by surface
import { getTaggedInfo, Tagged, Tag } from '../../core';

describe('VM', () => {
  let vm: VM;
  beforeEach(() => {
    vm = createVM();
  });

  describe('Stack operations', () => {
    test('should push and pop 20-bit values from the stack', () => {
      push(vm, 1.2);
      push(vm, 2.4);
      expect(pop(vm)).toBeCloseTo(2.4);
      expect(pop(vm)).toBeCloseTo(1.2);
    });
    test('should push and pop 32-bit floats from the stack', () => {
      push(vm, 3.14);
      push(vm, -123.456);
      expect(pop(vm)).toBeCloseTo(-123.456);
      expect(pop(vm)).toBeCloseTo(3.14);
    });
    test('should throw an error on stack overflow', () => {
      for (let i = 0; i < STACK_SIZE_BYTES / 4; i++) {
        push(vm, i);
      }

      expect(() => push(vm, 42)).toThrow('Stack overflow');
    });
    test('should throw an error on stack underflow', () => {
      expect(() => pop(vm)).toThrow('Stack underflow');
    });
    test('should return the correct stack data', () => {
      push(vm, 1);
      push(vm, 2);
      push(vm, 3);
      expect(getStackData(vm)).toEqual([1, 2, 3]);
    });
    test('should handle address tagging', () => {
      const address = 0x2345;
      push(vm, Tagged(encodeX1516(address), Tag.CODE));
      const { value, tag } = getTaggedInfo(pop(vm));
      expect(value).toBe(encodeX1516(address)); // Value is X1516 encoded
      expect(tag).toBe(Tag.CODE);
    });
  });

  describe('Return stack operations', () => {
    test('should push and pop 20-bit values from the return stack', () => {
      rpush(vm, 100);
      rpush(vm, 200);
      expect(rpop(vm)).toBe(200);
      expect(rpop(vm)).toBe(100);
    });
    test('should throw an error on return stack overflow', () => {
      for (let i = 0; i < RSTACK_SIZE_BYTES / 4; i++) {
        rpush(vm, i);
      }

      expect(() => rpush(vm, 42)).toThrow('Return stack (RSP) overflow');
    });
    test('should throw an error on return stack underflow', () => {
      expect(() => rpop(vm)).toThrow('Return stack (RSP) underflow');
    });
    test('should handle address tagging on return stack', () => {
      const address = 0x4321;
      rpush(vm, Tagged(encodeX1516(address), Tag.CODE));
      const { value, tag } = getTaggedInfo(rpop(vm));
      expect(tag).toBe(Tag.CODE);
      expect(value).toBe(encodeX1516(address)); // Value is X1516 encoded
    });
    test('should handle integer tagging on return stack', () => {
      rpush(vm, 0x2345);
      expect(rpop(vm)).toBe(0x2345);
    });
  });

  describe('Instruction pointer operations', () => {
    test('should read values from memory using the instruction pointer', () => {
      emitUint16(vm, 5);
      emitUint16(vm, 10);
      emitUint16(vm, 15);
      expect(nextInt16(vm)).toBe(5);
      expect(nextInt16(vm)).toBe(10);
      expect(nextInt16(vm)).toBe(15);
    });
    test('should increment the instruction pointer after reading', () => {
      emitUint16(vm, 42);
      nextInt16(vm);
      expect(vm.IP).toBe(2);
    });
    test('should handle nextAddress correctly', () => {
      const addr = 0x2345;
      emitTaggedAddress(vm, addr); // encode using X1516
      vm.IP = 0;
      expect(nextAddress(vm)).toBe(addr); // nextAddress decodes it
    });
  });

  describe('Compiler and dictionary initialization', () => {
    test('should initialize the compiler with the VM instance', () => {
      expect(vm.compiler).toBeDefined();
      expect(typeof vm.compiler).toBe('object');
      expect(vm.compiler).toHaveProperty('CP');
    });
    test('should initialize the dictionary with builtins', () => {
      // Builtins are registered during VM initialization, so head should be > 0
      expect(vm.head).toBeGreaterThan(0);
    });
    test('should expose compiled bytes in code segment', () => {
      emitOpcode(vm, 0x12);
      emitOpcode(vm, 0x34);
      emitOpcode(vm, 0x56);
      const bytes: number[] = [];
      for (let i = 0; i < vm.compiler.CP; i++) {
        bytes.push(vm.memory.read8(SEG_CODE, i));
      }
      expect(bytes).toEqual([0x12, 0x34, 0x56]);
    });
  });
});

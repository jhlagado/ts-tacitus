import { VM } from './vm';
import { STACK_SIZE, RSTACK_SIZE, SEG_CODE, SEG_RSTACK } from './memory';
import { Compiler } from '../lang/compiler';
import { SymbolTable } from '../strings/symbol-table';
import { fromTaggedValue, toTaggedValue, CoreTag } from './tagged';
import { Digest } from '../strings/digest';

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

  // Test 4: eval() method
  describe('eval()', () => {
    it('should push current IP to return stack and set IP to popped value', () => {
      const startIP = 0x1000;
      const targetIP = 0x2000;
      
      // Set up test
      vm.IP = startIP;
      vm.push(targetIP);
      
      // Execute
      vm.eval();
      
      // Verify IP was updated to the value from the stack
      expect(vm.IP).toBe(targetIP);
      
      // Verify return stack was updated
      expect(vm.RP).toBe(4); // 4 bytes for one return address
      
      // Verify the correct return address was pushed to the return stack
      const returnAddress = vm.memory.readFloat32(SEG_RSTACK, 0);
      const { value: returnIP, tag } = fromTaggedValue(returnAddress);
      expect(returnIP).toBe(startIP);
      expect(tag).toBe(CoreTag.CODE);
    });

    it('should handle tagged CODE values when setting IP', () => {
      const startIP = 0x1000;
      const targetIP = 0x2000;
      
      // Set up test with a tagged CODE value
      vm.IP = startIP;
      const taggedValue = toTaggedValue(targetIP, false, CoreTag.CODE);
      vm.push(taggedValue);
      
      // Execute
      vm.eval();
      
      // Verify IP was updated to the value from the stack
      expect(vm.IP).toBe(targetIP);
      
      // Verify return stack was updated
      expect(vm.RP).toBe(4);
    });
  });

  // Test 5: next8(), next16(), nextFloat32()
  describe('Memory reading operations', () => {
    beforeEach(() => {
      // Reset IP before each test
      vm.IP = 0;
    });

    it('should read 8-bit values with next8()', () => {
      // Write test bytes
      vm.memory.write8(SEG_CODE, 0, 0x12);
      vm.memory.write8(SEG_CODE, 1, 0x34);
      
      expect(vm.next8()).toBe(0x12);
      expect(vm.IP).toBe(1);
      expect(vm.next8()).toBe(0x34);
      expect(vm.IP).toBe(2);
    });

    it('should read 16-bit values with next16()', () => {
      // Write test bytes in little-endian order
      vm.memory.write8(SEG_CODE, 0, 0x34);
      vm.memory.write8(SEG_CODE, 1, 0x12); // 0x1234 in big-endian
      
      expect(vm.next16()).toBe(0x1234);
      expect(vm.IP).toBe(2);
    });

    it('should read 32-bit floats with nextFloat32()', () => {
      const testValue = 3.14159;
      const buffer = new ArrayBuffer(4);
      new DataView(buffer).setFloat32(0, testValue, true);
      const bytes = new Uint8Array(buffer);
      
      // Write the float bytes
      for (let i = 0; i < 4; i++) {
        vm.memory.write8(SEG_CODE, i, bytes[i]);
      }
      
      expect(vm.nextFloat32()).toBeCloseTo(testValue);
      expect(vm.IP).toBe(4);
    });
  });

  // Test 6: Error conditions and edge cases
  describe('Error conditions', () => {
    it('should handle stack underflow in pop() with detailed message', () => {
      try {
        vm.pop();
        fail('Expected an error');
      } catch (e: unknown) {
        const error = e as Error;
        expect(error.message).toContain('Stack underflow');
        expect(error.message).toContain('stack: []');
      }
    });

    it('should handle stack overflow in push() with detailed message', () => {
      // Fill up the stack
      const maxItems = STACK_SIZE / 4;
      for (let i = 0; i < maxItems; i++) {
        vm.push(i);
      }
      
      try {
        vm.push(42);
        fail('Expected an error');
      } catch (e: unknown) {
        const error = e as Error;
        expect(error.message).toContain('Stack overflow');
        expect(error.message).toContain('stack: [');
      }
    });
  });

  // Test 7: Compiler and symbol table initialization
  describe('Initialization', () => {
    it('should initialize with default values', () => {
      expect(vm.IP).toBe(0);
      expect(vm.SP).toBe(0);
      expect(vm.RP).toBe(0);
      expect(vm.BP).toBe(0);
      expect(vm.running).toBe(true);
      expect(vm.debug).toBe(false);
      expect(vm.memory).toBeDefined();
      expect(vm.compiler).toBeInstanceOf(Compiler);
      expect(vm.digest).toBeInstanceOf(Digest);
      expect(vm.symbolTable).toBeInstanceOf(SymbolTable);
    });
  });
});

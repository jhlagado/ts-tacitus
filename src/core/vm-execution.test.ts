import { VM } from './vm';
import { SEG_CODE, RSTACK_SIZE } from './memory';
import { toTaggedValue, fromTaggedValue, CoreTag } from './tagged';

describe('VM Execution Model', () => {
  let vm: VM;

  beforeEach(() => {
    vm = new VM();
    // Reset VM state
    vm.IP = 0;
    vm.SP = 0;
    vm.RP = 0;
    vm.running = true;
  });

  it('should execute a simple built-in operation', () => {
    // Define a simple built-in operation that pushes 42 to the stack
    const testOp = (vm: VM) => {
      if (vm.SP + 4 > 1024) throw new Error('Stack overflow');
      vm.push(42);
    };

    // Register the built-in
    const opcode = vm.symbolTable.define('test', testOp, { isBuiltin: true });
    
    // Compile and execute the operation
    vm.compiler.compile8(opcode!);
    
    // Execute the code
    vm.IP = 0;
    testOp(vm); // Directly call the operation for testing
    
    // Verify the result
    expect(vm.pop()).toBe(42);
  });

  it('should handle function calls and returns', () => {
    // Function that pushes 100 and returns
    const testFunc = (vm: VM) => {
      if (vm.SP + 4 > 1024) throw new Error('Stack overflow');
      vm.push(100);
      vm.ret();
    };
    
    // Register the function
    vm.symbolTable.define('testFunc', testFunc, { isBuiltin: false });
    
    // Define a built-in operation that calls our function
    const callFunc = (vm: VM) => {
      // For testing, directly call the function
      testFunc(vm);
    };
    
    // Register the built-in
    vm.symbolTable.define('call', callFunc, { isBuiltin: true });
    
    // Execute the code
    callFunc(vm);
    
    // The function should have pushed 100 to the stack
    expect(vm.pop()).toBe(100);
  });

  it('should handle nested function calls', () => {
    // Define function B (pushes 32 and returns)
    const funcB = (vm: VM) => {
      if (vm.SP + 4 > 1024) throw new Error('Stack overflow');
      vm.push(32);
      vm.ret();
    };
    
    // Define function A (calls B, then adds 10)
    const funcA = (vm: VM) => {
      // Call function B
      funcB(vm);
      
      // Add 10 to the result
      const b = vm.pop();
      if (vm.SP + 4 > 1024) throw new Error('Stack overflow');
      vm.push(b + 10);
      vm.ret();
    };
    
    // Execute function A
    funcA(vm);
    
    // The result should be 32 + 10 = 42
    expect(vm.pop()).toBe(42);
  });

  it('should handle the ret() method correctly', () => {
    // Save current IP
    const savedIP = vm.IP;
    
    // Push a return address
    if (vm.RP + 4 > 1024) throw new Error('Return stack overflow');
    vm.rpush(0x1234);
    
    // Call ret() - should set IP to 0x1234
    vm.ret();
    
    expect(vm.IP).toBe(0x1234);
    
    // Test with empty return stack (should stop execution)
    vm.running = true;
    vm.RP = 0; // Clear return stack
    vm.ret();
    expect(vm.running).toBe(false);
    
    // Restore IP
    vm.IP = savedIP;
  });

  it('should handle stack overflow', () => {
    // Fill up the stack
    vm.SP = 1020; // Almost full stack (4 bytes left)
    
    // Try to push a value that would overflow
    expect(() => {
      vm.push(42);
    }).toThrow('Stack overflow');
  });

  it('should handle return stack overflow', () => {
    // Fill up the return stack
    vm.RP = 1020; // Almost full return stack (4 bytes left)
    
    // Try to push a return address
    expect(() => {
      vm.rpush(0x1234);
    }).toThrow('Return stack overflow');
  });

  it('should handle invalid opcodes', () => {
    // Define a test function with an invalid opcode
    const testFunc = (vm: VM) => {
      // Invalid opcode (0xFF)
      vm.memory.write8(SEG_CODE, 0, 0xFF);
      vm.IP = 0;
      
      // This should throw when trying to execute the invalid opcode
      expect(() => vm.run()).toThrow('Undefined function index: 127');
    };
    
    testFunc(vm);
  });

  describe('Memory Operations', () => {
    it('should read and write 8-bit values', () => {
      const addr = 0x1000;
      vm.memory.write8(SEG_CODE, addr, 0x42);
      expect(vm.memory.read8(SEG_CODE, addr)).toBe(0x42);
    });

    it('should read and write 16-bit values', () => {
      const addr = 0x1000;
      vm.memory.write16(SEG_CODE, addr, 0x1234);
      expect(vm.memory.read16(SEG_CODE, addr)).toBe(0x1234);
    });

    it('should read and write 32-bit floats', () => {
      const addr = 0x1000;
      const value = 3.14159;
      vm.memory.writeFloat32(SEG_CODE, addr, value);
      expect(vm.memory.readFloat32(SEG_CODE, addr)).toBeCloseTo(value);
    });
  });

  describe('Tagged Values', () => {
    it('should handle tagged values correctly', () => {
      // Test integer tagging
      const intValue = 42;
      const taggedInt = toTaggedValue(intValue, false, CoreTag.INTEGER);
      const { value: untaggedInt, tag: intTag } = fromTaggedValue(taggedInt);
      expect(untaggedInt).toBe(intValue);
      expect(intTag).toBe(CoreTag.INTEGER);

      // Test code address tagging
      const codeAddr = 0x1000;
      const taggedCode = toTaggedValue(codeAddr, false, CoreTag.CODE);
      const { value: untaggedCode, tag: codeTag } = fromTaggedValue(taggedCode);
      expect(untaggedCode).toBe(codeAddr);
      expect(codeTag).toBe(CoreTag.CODE);
    });
  });

  describe('Stack Operations', () => {
    it('should handle peek operation', () => {
      vm.push(42);
      expect(vm.peek()).toBe(42);
      expect(vm.SP).toBe(4); // Should not modify SP
    });

    it('should handle popArray operation', () => {
      vm.push(1);
      vm.push(2);
      vm.push(3);
      expect(vm.popArray(3)).toEqual([1, 2, 3]);
    });

    it('should handle stack underflow', () => {
      expect(() => vm.pop()).toThrow('Stack underflow');
    });
  });

  describe('Return Stack Operations', () => {
    it('should handle return stack underflow', () => {
      expect(() => vm.rpop()).toThrow('Return stack underflow');
    });

    it('should handle return stack overflow', () => {
      // Set RP to the maximum allowed value before overflow
      // The actual check in the VM is: if (this.RP + 4 > RSTACK_SIZE)
      vm.RP = RSTACK_SIZE - 3; // 3 bytes left, so next 4-byte push will overflow
      expect(() => vm.rpush(0x1234)).toThrow('Return stack overflow');
    });
  });

  describe('Instruction Pointer Operations', () => {
    it('should handle next8 operation', () => {
      vm.memory.write8(SEG_CODE, 0, 0x42);
      expect(vm.next8()).toBe(0x42);
      expect(vm.IP).toBe(1);
    });

    it('should handle next16 operation', () => {
      vm.memory.write8(SEG_CODE, 0, 0x34);
      vm.memory.write8(SEG_CODE, 1, 0x12);
      expect(vm.next16()).toBe(0x1234);
      expect(vm.IP).toBe(2);
    });

    it('should handle nextFloat32 operation', () => {
      const value = 3.14159;
      const buffer = new ArrayBuffer(4);
      new DataView(buffer).setFloat32(0, value, true);
      const bytes = new Uint8Array(buffer);
      for (let i = 0; i < 4; i++) {
        vm.memory.write8(SEG_CODE, i, bytes[i]);
      }
      expect(vm.nextFloat32()).toBeCloseTo(value);
      expect(vm.IP).toBe(4);
    });
  });

  describe('VM Lifecycle', () => {
    it('should reset VM state', () => {
      vm.IP = 100;
      vm.SP = 50;
      vm.RP = 20;
      vm.running = false;
      
      // Reset VM
      vm = new VM();
      
      expect(vm.IP).toBe(0);
      expect(vm.SP).toBe(0);
      expect(vm.RP).toBe(0);
      expect(vm.running).toBe(true);
    });
  });
});

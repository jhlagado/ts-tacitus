import { FunctionTable, OpcodeFunction } from '../../core/function-table';
import { VM } from '../../core/vm';
import { initializeInterpreter } from '../../core/globalState';

describe('FunctionTable', () => {
  let functionTable: FunctionTable;
  let vm: VM;

  beforeEach(() => {
    initializeInterpreter();
    functionTable = new FunctionTable();
    vm = new VM();
  });

  describe('constructor', () => {
    test('should initialize with empty table', () => {
      const table = new FunctionTable();
      expect(table).toBeInstanceOf(FunctionTable);
    });
  });

  describe('registerBuiltin', () => {
    test('should register built-in functions at valid indices', () => {
      const testFn: OpcodeFunction = (vm: VM) => { vm.push(42); };
      
      expect(() => functionTable.registerBuiltin(0, testFn)).not.toThrow();
      expect(() => functionTable.registerBuiltin(127, testFn)).not.toThrow();
      expect(() => functionTable.registerBuiltin(50, testFn)).not.toThrow();
    });

    test('should throw error for invalid indices', () => {
      const testFn: OpcodeFunction = (vm: VM) => { vm.push(42); };
      
      expect(() => functionTable.registerBuiltin(-1, testFn))
        .toThrow('Built-in operations must have indices between 0-127, got -1');
      expect(() => functionTable.registerBuiltin(128, testFn))
        .toThrow('Built-in operations must have indices between 0-127, got 128');
      expect(() => functionTable.registerBuiltin(1000, testFn))
        .toThrow('Built-in operations must have indices between 0-127, got 1000');
    });
  });

  describe('registerBuiltinOpcode', () => {
    test('should register built-in opcodes at valid indices', () => {
      const testFn: OpcodeFunction = (vm: VM) => { vm.push(42); };
      
      expect(() => functionTable.registerBuiltinOpcode(0, testFn)).not.toThrow();
      expect(() => functionTable.registerBuiltinOpcode(127, testFn)).not.toThrow();
      expect(() => functionTable.registerBuiltinOpcode(75, testFn)).not.toThrow();
    });

    test('should throw error for invalid opcodes', () => {
      const testFn: OpcodeFunction = (vm: VM) => { vm.push(42); };
      
      expect(() => functionTable.registerBuiltinOpcode(-1, testFn))
        .toThrow('Opcode -1 is outside the valid built-in range (0-127)');
      expect(() => functionTable.registerBuiltinOpcode(128, testFn))
        .toThrow('Opcode 128 is outside the valid built-in range (0-127)');
    });
  });

  describe('registerWord', () => {
    test('should register user-defined words starting at index 128', () => {
      const testFn1: OpcodeFunction = (vm: VM) => { vm.push(1); };
      const testFn2: OpcodeFunction = (vm: VM) => { vm.push(2); };
      
      const index1 = functionTable.registerWord(testFn1);
      const index2 = functionTable.registerWord(testFn2);
      
      expect(index1).toBe(128);
      expect(index2).toBe(129);
    });

    test('should assign sequential indices for multiple words', () => {
      const indices: number[] = [];
      
      for (let i = 0; i < 10; i++) {
        const testFn: OpcodeFunction = (vm: VM) => { vm.push(i); };
        indices.push(functionTable.registerWord(testFn));
      }
      
      expect(indices).toEqual([128, 129, 130, 131, 132, 133, 134, 135, 136, 137]);
    });

    test('should handle gaps in the table', () => {
      const testFn: OpcodeFunction = (vm: VM) => { vm.push(42); };
      
      // Register some built-ins to create gaps
      functionTable.registerBuiltin(10, testFn);
      functionTable.registerBuiltin(50, testFn);
      
      // User words should still start at 128
      const index = functionTable.registerWord(testFn);
      expect(index).toBe(128);
    });
  });

  describe('execute', () => {
    test('should execute registered built-in functions', () => {
      const testFn: OpcodeFunction = (vm: VM) => { vm.push(42); };
      functionTable.registerBuiltin(10, testFn);
      
      functionTable.execute(vm, 10);
      
      expect(vm.pop()).toBe(42);
    });

    test('should execute registered user-defined words', () => {
      const testFn: OpcodeFunction = (vm: VM) => { vm.push(100); };
      const index = functionTable.registerWord(testFn);
      
      functionTable.execute(vm, index);
      
      expect(vm.pop()).toBe(100);
    });

    test('should throw error for unregistered function index', () => {
      expect(() => functionTable.execute(vm, 50))
        .toThrow('No function registered at index 50');
      expect(() => functionTable.execute(vm, 200))
        .toThrow('No function registered at index 200');
    });

    test('should pass VM instance correctly to functions', () => {
      let capturedVm: VM | null = null;
      const testFn: OpcodeFunction = (vmInstance: VM) => { capturedVm = vmInstance; };
      
      functionTable.registerBuiltin(15, testFn);
      functionTable.execute(vm, 15);
      
      expect(capturedVm).toBe(vm);
    });
  });

  describe('encodeAddress', () => {
    test('should encode built-in addresses as single bytes', () => {
      expect(functionTable.encodeAddress(0)).toEqual(new Uint8Array([0]));
      expect(functionTable.encodeAddress(127)).toEqual(new Uint8Array([127]));
      expect(functionTable.encodeAddress(50)).toEqual(new Uint8Array([50]));
    });

    test('should encode user word addresses as two bytes', () => {
      // Address 128: low 7 bits = 0, high bits = 1
      expect(functionTable.encodeAddress(128)).toEqual(new Uint8Array([0x80, 0x01]));
      
      // Address 255: low 7 bits = 127, high bits = 1  
      expect(functionTable.encodeAddress(255)).toEqual(new Uint8Array([0xFF, 0x01]));
      
      // Address 256: low 7 bits = 0, high bits = 2
      expect(functionTable.encodeAddress(256)).toEqual(new Uint8Array([0x80, 0x02]));
      
      // Address 32767: maximum valid address
      expect(functionTable.encodeAddress(32767)).toEqual(new Uint8Array([0xFF, 0xFF]));
    });

    test('should throw error for invalid addresses', () => {
      expect(() => functionTable.encodeAddress(-1))
        .toThrow('Invalid function address: -1');
      expect(() => functionTable.encodeAddress(32768))
        .toThrow('Invalid function address: 32768');
      expect(() => functionTable.encodeAddress(100000))
        .toThrow('Invalid function address: 100000');
    });
  });

  describe('decodeAddress', () => {
    test('should decode single-byte built-in addresses', () => {
      expect(functionTable.decodeAddress(new Uint8Array([0]))).toEqual([0, 1]);
      expect(functionTable.decodeAddress(new Uint8Array([127]))).toEqual([127, 1]);
      expect(functionTable.decodeAddress(new Uint8Array([50]))).toEqual([50, 1]);
    });

    test('should decode two-byte user word addresses', () => {
      expect(functionTable.decodeAddress(new Uint8Array([0x80, 0x01]))).toEqual([128, 2]);
      expect(functionTable.decodeAddress(new Uint8Array([0xFF, 0x01]))).toEqual([255, 2]);
      expect(functionTable.decodeAddress(new Uint8Array([0x80, 0x02]))).toEqual([256, 2]);
      expect(functionTable.decodeAddress(new Uint8Array([0xFF, 0xFF]))).toEqual([32767, 2]);
    });

    test('should handle offset parameter', () => {
      const bytes = new Uint8Array([50, 75, 0x80, 0x01]); // Use single-byte values for first two
      
      expect(functionTable.decodeAddress(bytes, 0)).toEqual([50, 1]);
      expect(functionTable.decodeAddress(bytes, 1)).toEqual([75, 1]);
      expect(functionTable.decodeAddress(bytes, 2)).toEqual([128, 2]);
    });

    test('should work with longer byte arrays', () => {
      const bytes = new Uint8Array([10, 20, 30, 0x90, 0x05, 40]);
      
      expect(functionTable.decodeAddress(bytes, 0)).toEqual([10, 1]);
      expect(functionTable.decodeAddress(bytes, 3)).toEqual([656, 2]); // 0x90 & 0x7F = 16, 0x05 << 7 = 640, total = 656
    });
  });

  describe('encode/decode round trip', () => {
    test('should maintain address integrity through encode/decode cycle', () => {
      const testAddresses = [0, 1, 50, 127, 128, 255, 256, 1000, 32767];
      
      for (const address of testAddresses) {
        const encoded = functionTable.encodeAddress(address);
        const [decoded, bytesConsumed] = functionTable.decodeAddress(encoded);
        
        expect(decoded).toBe(address);
        expect(bytesConsumed).toBe(address < 128 ? 1 : 2);
      }
    });
  });

  describe('integration tests', () => {
    test('should handle mixed built-in and user-defined functions', () => {
      // Register built-in functions
      const addFn: OpcodeFunction = (vm: VM) => {
        const b = vm.pop();
        const a = vm.pop();
        vm.push(a + b);
      };
      
      const mulFn: OpcodeFunction = (vm: VM) => {
        const b = vm.pop();
        const a = vm.pop();
        vm.push(a * b);
      };
      
      functionTable.registerBuiltin(1, addFn);
      functionTable.registerBuiltin(2, mulFn);
      
      // Register user-defined word
      const squareFn: OpcodeFunction = (vm: VM) => {
        const x = vm.pop();
        vm.push(x * x);
      };
      
      const squareIndex = functionTable.registerWord(squareFn);
      
      // Test built-in addition
      vm.push(5);
      vm.push(3);
      functionTable.execute(vm, 1);
      expect(vm.pop()).toBe(8);
      
      // Test built-in multiplication  
      vm.push(4);
      vm.push(6);
      functionTable.execute(vm, 2);
      expect(vm.pop()).toBe(24);
      
      // Test user-defined square
      vm.push(7);
      functionTable.execute(vm, squareIndex);
      expect(vm.pop()).toBe(49);
    });

    test('should handle bytecode encoding for function calls', () => {
      const testFn: OpcodeFunction = (vm: VM) => { vm.push(999); };
      
      // Register functions at various indices
      functionTable.registerBuiltin(5, testFn);
      const wordIndex = functionTable.registerWord(testFn);
      
      // Test encoding and execution
      const builtinEncoded = functionTable.encodeAddress(5);
      const wordEncoded = functionTable.encodeAddress(wordIndex);
      
      expect(builtinEncoded.length).toBe(1);
      expect(wordEncoded.length).toBe(2);
      
      // Decode and execute
      const [builtinDecoded] = functionTable.decodeAddress(builtinEncoded);
      const [wordDecoded] = functionTable.decodeAddress(wordEncoded);
      
      functionTable.execute(vm, builtinDecoded);
      expect(vm.pop()).toBe(999);
      
      functionTable.execute(vm, wordDecoded);
      expect(vm.pop()).toBe(999);
    });
  });
});

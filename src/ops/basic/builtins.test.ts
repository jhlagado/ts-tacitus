import { VM } from '../../core/vm';
import { registerBasicOps } from './builtins';

describe('Basic Operations', () => {
  let vm: VM;
  let ops: ReturnType<typeof registerBasicOps>;

  beforeEach(() => {
    vm = new VM();
    ops = registerBasicOps();
  });

  // Helper function to execute an operation in RPN (Reverse Polish Notation) order
  // Example: executeOp(2, 3, '+') will push 2, then 3, then execute +
  const executeOp = (...args: (number | string)[]) => {
    // The last argument is the operator
    const op = args[args.length - 1];
    if (typeof op !== 'string') {
      throw new Error('Last argument must be the operator as a string');
    }
    
    // Push all values (all args except the last one)
    for (let i = 0; i < args.length - 1; i++) {
      const value = args[i];
      if (typeof value !== 'number') {
        throw new Error('All arguments except the last must be numbers');
      }
      vm.push(value);
    }
    
    // Execute the operation
    ops[op](vm);
  };

  describe('Stack Operations', () => {
    test('dup duplicates the top stack item', () => {
      vm.push(42);
      ops.dup(vm);
      expect(vm.pop()).toBe(42);
      expect(vm.pop()).toBe(42);
    });

    test('drop removes the top stack item', () => {
      vm.push(1);
      vm.push(2);
      ops.drop(vm);
      expect(vm.pop()).toBe(1);
    });

    test('swap swaps the top two stack items', () => {
      vm.push(1);
      vm.push(2);
      ops.swap(vm);
      expect(vm.pop()).toBe(1);
      expect(vm.pop()).toBe(2);
    });

    test('over duplicates the second stack item to the top', () => {
      vm.push(1);
      vm.push(2);
      ops.over(vm);
      expect(vm.pop()).toBe(1);
      expect(vm.pop()).toBe(2);
      expect(vm.pop()).toBe(1);
    });

    test('rot rotates the top three stack items', () => {
      vm.push(1);
      vm.push(2);
      vm.push(3);
      ops.rot(vm);
      expect(vm.pop()).toBe(1);
      expect(vm.pop()).toBe(3);
      expect(vm.pop()).toBe(2);
    });
  });

  describe('Arithmetic Operations', () => {
    test('+ adds two numbers', () => {
      executeOp(2, 3, '+'); // 2 3 + -> 5
      expect(vm.pop()).toBe(5);
    });

    test('- subtracts two numbers', () => {
      executeOp(5, 3, '-'); // 5 3 - -> 2
      expect(vm.pop()).toBe(2);
    });

    test('* multiplies two numbers', () => {
      executeOp(4, 3, '*'); // 4 3 * -> 12
      expect(vm.pop()).toBe(12);
    });

    test('/ divides two numbers', () => {
      executeOp(10, 2, '/'); // 10 2 / -> 5
      expect(vm.pop()).toBe(5);
    });

    test('mod calculates the remainder of division', () => {
      executeOp(10, 3, 'mod'); // 10 3 mod -> 1
      expect(vm.pop()).toBe(1);
    });

    test('arithmetic operations throw error with tagged values', () => {
      // Test each operation with a tagged value (NaN) as the first operand
      vm.push(NaN); // Simulate tagged value with NaN
      vm.push(1);
      expect(() => ops['+'](vm)).toThrow('Arithmetic operations only work with float values');
      
      // Reset stack for next test
      vm = new VM();
      vm.push(1);
      vm.push(NaN); // Simulate tagged value with NaN as second operand
      expect(() => ops['+'](vm)).toThrow('Arithmetic operations only work with float values');
      
      // Test other operations with the same pattern
      vm = new VM();
      vm.push(NaN);
      vm.push(1);
      expect(() => ops['-'](vm)).toThrow('Arithmetic operations only work with float values');
      
      vm = new VM();
      vm.push(1);
      vm.push(NaN);
      expect(() => ops['-'](vm)).toThrow('Arithmetic operations only work with float values');
      
      vm = new VM();
      vm.push(NaN);
      vm.push(1);
      expect(() => ops['*'](vm)).toThrow('Arithmetic operations only work with float values');
      
      vm = new VM();
      vm.push(1);
      vm.push(NaN);
      expect(() => ops['*'](vm)).toThrow('Arithmetic operations only work with float values');
      
      vm = new VM();
      vm.push(NaN);
      vm.push(1);
      expect(() => ops['/'](vm)).toThrow('Arithmetic operations only work with float values');
      
      vm = new VM();
      vm.push(1);
      vm.push(NaN);
      expect(() => ops['/'](vm)).toThrow('Arithmetic operations only work with float values');
      
      vm = new VM();
      vm.push(NaN);
      vm.push(1);
      expect(() => ops['mod'](vm)).toThrow('Arithmetic operations only work with float values');
      
      vm = new VM();
      vm.push(1);
      vm.push(NaN);
      expect(() => ops['mod'](vm)).toThrow('Arithmetic operations only work with float values');
    });
  });

  describe('Comparison Operations', () => {
    test('= compares two numbers for equality', () => {
      executeOp(5, 5, '='); // 5 5 = -> true (1)
      expect(vm.pop()).toBe(1); // true
      executeOp(5, 3, '='); // 5 3 = -> false (0)
      expect(vm.pop()).toBe(0); // false
    });

    test('< compares if first number is less than second', () => {
      executeOp(5, 3, '<'); // 5 3 < -> false (0)
      expect(vm.pop()).toBe(0); // false
      executeOp(3, 5, '<'); // 3 5 < -> true (1)
      expect(vm.pop()).toBe(1); // true
    });

    test('> compares if first number is greater than second', () => {
      executeOp(3, 5, '>'); // 3 5 > -> false (0)
      expect(vm.pop()).toBe(0); // false
      executeOp(5, 3, '>'); // 5 3 > -> true (1)
      expect(vm.pop()).toBe(1); // true
    });
  });

  describe('Control Flow', () => {
    test('if executes the then-branch when condition is true', () => {
      // Push condition (true) and addresses using RPN-style
      vm.push(1); // Dummy return address
      vm.push(-1); // true condition
      vm.push(10); // then-branch address
      vm.push(20); // else-branch address
      
      const savedIp = vm.IP;
      
      // Execute if (takes condition, then-addr, else-addr from stack)
      ops.if(vm);
      
      // Should jump to then-branch (10)
      expect(vm.IP).toBe(10);
      
      // Restore VM state
      vm.IP = savedIp;
    });

    test('if executes the else-branch when condition is false', () => {
      // Push condition (false) and addresses using RPN-style
      vm.push(1); // Dummy return address
      vm.push(0); // false condition
      vm.push(10); // then-branch address
      vm.push(20); // else-branch address
      
      const savedIp = vm.IP;
      
      // Execute if (pops else-addr, then-addr, condition from stack)
      ops.if(vm);
      
      // Should jump to else-branch (20)
      expect(vm.IP).toBe(20);
      
      // Restore VM state
      vm.IP = savedIp;
    });
  });
});

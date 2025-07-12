import { VM } from '../core/vm';
import { Tag } from '../core/tagged';

type StackSetup = (vm: VM) => void;
type StackOperation = (vm: VM) => void;
type StackVerification = (stack: number[]) => void;

export interface StackTestConfig {
  name: string;
  setup: StackSetup;
  operation: StackOperation;
  verify: StackVerification;
  expectedStack?: number[];
  skip?: boolean;
}

export function testStackOperation(config: StackTestConfig) {
  const testFn = config.skip ? it.skip : it;
  
  testFn(config.name, () => {
    const vm = new VM();
    
    // Setup initial stack state
    config.setup(vm);
    
    // Store pre-operation stack for debugging
    const beforeStack = [...vm.getStackData()];
    
    // Perform the operation
    config.operation(vm);
    
    // Verify the stack
    const afterStack = vm.getStackData();
    
    try {
      // If expected stack is provided, verify it
      if (config.expectedStack) {
        expect(afterStack).toEqual(config.expectedStack);
      }
      
      // Run custom verification if provided
      if (config.verify) {
        config.verify(afterStack);
      }
    } catch (error) {
      // Enhance error message with before/after stack info
      console.error('Stack before operation:', beforeStack);
      console.error('Stack after operation:', afterStack);
      throw error;
    }
  });
}

export function expectStackUnderflow(operation: StackOperation) {
  const vm = new VM();
  expect(() => operation(vm)).toThrow('Stack underflow');
}

export function withStack(...values: number[]): StackSetup {
  return (vm: VM) => {
    values.forEach(v => vm.push(v));
  };
}

export function withList(values: number[]): StackSetup {
  return (vm: VM) => {
    // Push list elements
    values.forEach(v => vm.push(v));
    
    // Push LINK tag
    const linkValue = values.length + 1; // +1 for LIST tag
    vm.memory.writeFloat32(0, vm.SP, (Tag.LINK << 24) | (linkValue & 0xffffff));
    vm.SP += 4;
    
    // Push LIST tag with size
    vm.memory.writeFloat32(0, vm.SP, (Tag.LIST << 24) | (values.length & 0xffffff));
    vm.SP += 4;
  };
}

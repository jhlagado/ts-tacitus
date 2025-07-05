import { vm as globalVM, initializeInterpreter } from '../global-state';
import { VM } from '../vm';

describe('Global State', () => {
  test('should export a VM instance', () => {
    expect(globalVM).toBeDefined();
    expect(globalVM).toBeInstanceOf(VM);
  });
  
  test('initializeInterpreter should create a new VM instance', () => {
    // Save the current VM reference
    const oldVM = globalVM;
    
    // Initialize a new interpreter
    initializeInterpreter();
    
    // Should create a new VM instance
    expect(globalVM).toBeDefined();
    expect(globalVM).toBeInstanceOf(VM);
    expect(globalVM).not.toBe(oldVM);
  });
  
  test('should have a working VM instance', () => {
    // Test basic VM functionality with a local VM instance
    const vm = new VM();
    vm.push(42);
    expect(vm.pop()).toBe(42);
  });
  
  test('should maintain separate VM instances', () => {
    // Create a new VM
    const vm1 = new VM();
    
    // Push to the first VM
    vm1.push(100);
    
    // Create a second VM
    const vm2 = new VM();
    
    // The second VM's stack should be empty
    expect(() => vm2.pop()).toThrow('Stack underflow');
    
    // The first VM's stack should still have the value
    expect(vm1.pop()).toBe(100);
  });
});

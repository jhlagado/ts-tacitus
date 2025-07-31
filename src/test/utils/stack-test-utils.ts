/**
 * Comprehensive stack testing utilities - Consolidation of stack-test-utils.ts and stack-utils.ts
 * Provides both high-level test configuration and low-level stack manipulation utilities
 */
import { VM } from '../../core/vm';
import { Tag, toTaggedValue, fromTaggedValue } from '../../core/tagged';

// ================================
// HIGH-LEVEL TESTING FRAMEWORK
// ================================

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

    config.setup(vm);

    const beforeStack = [...vm.getStackData()];

    config.operation(vm);

    const afterStack = vm.getStackData();

    try {
      if (config.expectedStack) {
        expect(afterStack).toEqual(config.expectedStack);
      }

      if (config.verify) {
        config.verify(afterStack);
      }
    } catch (error) {
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

// ================================
// STACK SETUP UTILITIES
// ================================

export function withStack(...values: number[]): StackSetup {
  return (vm: VM) => {
    values.forEach(v => vm.push(v));
  };
}

export function withList(values: number[]): StackSetup {
  return (vm: VM) => {
    values.forEach(v => vm.push(v));

    const linkValue = values.length + 1;
    vm.memory.writeFloat32(0, vm.SP, (Tag.LINK << 24) | (linkValue & 0xffffff));
    vm.SP += 4;

    vm.memory.writeFloat32(0, vm.SP, (Tag.LIST << 24) | (values.length & 0xffffff));
    vm.SP += 4;
  };
}

// ================================
// LOW-LEVEL STACK MANIPULATION
// ================================

/**
 * Pushes a value with an optional tag onto the VM stack
 */
export function pushValue(vm: VM, value: number, tag: Tag = Tag.NUMBER): void {
  vm.memory.writeFloat32(0, vm.SP, toTaggedValue(value, tag));
  vm.SP += 4;
}

/**
 * Pushes a list of values onto the stack with proper LIST and LINK tags
 */
export function pushList(vm: VM, values: number[]): void {
  for (const val of values) {
    vm.push(val);
  }

  const linkValue = values.length + 1;
  pushValue(vm, linkValue, Tag.LINK);

  pushValue(vm, values.length, Tag.LIST);
}

/**
 * Returns the stack contents with decoded values and tags
 */
export function getStackWithTags(vm: VM): Array<{ value: number; tag: string }> {
  return vm.getStackData().map(v => {
    try {
      const { value, tag } = fromTaggedValue(v);
      return { value, tag: Tag[tag] };
    } catch {
      return { value: v, tag: 'RAW' };
    }
  });
}

/**
 * Creates a stack trace string for debugging
 */
export function formatStack(vm: VM): string {
  return getStackWithTags(vm)
    .map(({ value, tag }) => `${value} (${tag})`)
    .join(' | ');
}

/**
 * Pops and returns the top value from the stack, with tag information
 */
export function popWithTag(vm: VM): { value: number; tag: Tag } {
  const value = vm.pop();
  try {
    return fromTaggedValue(value);
  } catch {
    return { value, tag: Tag.NUMBER };
  }
}

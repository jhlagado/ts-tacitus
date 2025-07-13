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

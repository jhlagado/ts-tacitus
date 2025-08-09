import { VM } from '../core/vm';
import { Tag } from '../core/tagged';

export class TestList {
  private values: number[];
  private size: number;

  constructor(values: number[]) {
    this.values = values;
    this.size = values.length + 1;
  }

  copyToStack(vm: VM): void {
    for (const value of this.values) {
      vm.push(value);
    }
    const listTagged = (Tag.RLIST << 24) | (this.values.length & 0xffffff);
    vm.push(listTagged);
  }

  getSize(): number {
    return this.size;
  }
}

export function createSimpleList(values: number[]): TestList {
  return new TestList(values);
}

export function pushList(vm: VM, values: number[]): void {
  const list = createSimpleList(values);
  list.copyToStack(vm);
}

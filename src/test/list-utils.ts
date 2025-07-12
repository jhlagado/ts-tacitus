import { VM } from '../core/vm';
import { Tag } from '../core/tagged';

export class TestList {
  private values: number[];
  private size: number;

  constructor(values: number[]) {
    this.values = values;
    this.size = values.length + 2; // LIST tag + elements + LINK tag
  }

  copyToStack(vm: VM): void {
    // Push the list elements
    for (const value of this.values) {
      vm.push(value);
    }
    
    // Push the LINK tag (points to the LIST tag)
    const linkValue = (this.values.length + 1) * 4;
    const linkTagged = (Tag.LINK << 24) | (linkValue & 0xffffff);
    vm.push(linkTagged);
    
    // Push the LIST tag with size
    const listTagged = (Tag.LIST << 24) | (this.values.length & 0xffffff);
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

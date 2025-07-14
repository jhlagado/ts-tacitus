import { VM } from '../../core/vm';
import { Tag, toTaggedValue, fromTaggedValue } from '../../core/tagged';

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

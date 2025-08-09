/**
 * Comprehensive list testing utilities - Consolidation and enhancement of list-utils.ts
 * Provides utilities for creating, manipulating, and testing list structures in TACIT
 */
import { VM } from '../../core/vm';
import { Tag, fromTaggedValue } from '../../core/tagged';

// ================================
// LIST CREATION UTILITIES
// ================================

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
    vm.push((Tag.RLIST << 24) | (this.values.length & 0xffffff));
  }

  getSize(): number {
    return this.size;
  }

  getValues(): number[] {
    return [...this.values];
  }
}

export function createSimpleList(values: number[]): TestList {
  return new TestList(values);
}

export function pushList(vm: VM, values: number[]): void {
  const list = createSimpleList(values);
  list.copyToStack(vm);
}

// ================================
// LIST VERIFICATION UTILITIES
// ================================

/**
 * Verify the structure of a list on the stack
 */
export interface ListElement {
  type: 'number' | 'list';
  value?: number;
  children?: ListElement[];
}

export function verifyListStructure(stack: number[], expectList: ListElement): void {
  let index = 0;

  function verifyElement(element: ListElement): void {
    if (index >= stack.length) {
      throw new Error(
        `Stack underflow: expected element at index ${index} but stack length is ${stack.length}`,
      );
    }

    const stackValue = stack[index];
    const { tag, value } = fromTaggedValue(stackValue);

    if (element.type === 'number') {
      expect([Tag.INTEGER, Tag.NUMBER]).toContain(tag);
      if (element.value !== undefined) {
        expect(value).toBe(element.value);
      }
      index++;
    } else if (element.type === 'list') {
      expect(tag).toBe(Tag.RLIST);
      index++;

      if (element.children) {
        for (const child of element.children) {
          verifyElement(child);
        }
      }
    }
  }

  verifyElement(expectList);
}

// ================================
// LIST MANIPULATION HELPERS
// ================================

/**
 * Create a nested list structure for testing
 */
export function createNestedList(structure: any[]): TestList {
  const flatValues: number[] = [];

  function flatten(item: any): void {
    if (Array.isArray(item)) {
      // This is a nested list - handle recursively
      for (const subItem of item) {
        flatten(subItem);
      }
    } else {
      // This is a number value
      flatValues.push(item);
    }
  }

  for (const item of structure) {
    flatten(item);
  }

  return new TestList(flatValues);
}

/**
 * Extract list values from stack, following TACIT list structure
 */
export function extractListFromStack(
  stack: number[],
  startIndex = 0,
): {
  values: number[];
  nextIndex: number;
} {
  const values: number[] = [];
  let index = startIndex;

  const { tag: listTag, value: slots } = fromTaggedValue(stack[index]);
  if (listTag !== Tag.RLIST) {
    throw new Error(`Expected RLIST tag at index ${index}, got ${Tag[listTag]}`);
  }
  for (let i = 0; i < slots; i++) {
    const elemIndex = index - 1 - i;
    if (elemIndex < 0) throw new Error('Stack underflow while extracting list values');
    values.unshift(stack[elemIndex]);
  }
  index -= (slots + 1);

  return { values, nextIndex: index };
}

/**
 * Count the number of lists on the stack
 */
export function countListsOnStack(stack: number[]): number {
  let count = 0;
  for (const item of stack) {
    const { tag } = fromTaggedValue(item);
    if (tag === Tag.RLIST) {
      count++;
    }
  }
  return count;
}

/**
 * Check if the stack contains a list with specific values
 */
export function stackContainsList(stack: number[], expectedValues: number[]): boolean {
  // This is a simplified check - in a real implementation,
  // we'd need to parse the list structure properly
  return expectedValues.every(value => stack.includes(value));
}

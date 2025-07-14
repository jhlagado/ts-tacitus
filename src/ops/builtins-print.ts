/**
 * @file builtins-print.ts
 * Implementation of the print and dot operations for the Tacit VM
 */
import { VM } from '../core/vm';
import { fromTaggedValue, Tag } from '../core/tagged';
import { BYTES_PER_ELEMENT } from '../core/constants';

/**
 * Format a single value for output
 */
function formatValue(vm: VM, value: number): string {
  const { tag, value: tagValue } = fromTaggedValue(value);

  // Handle tagged values
  if (tag !== Tag.NUMBER && tag !== Tag.INTEGER) {
    return `${Tag[tag]}:${tagValue}`;
  }

  // Regular number
  return String(tagValue);
}

/**
 * Format a list value for output
 */
function formatList(vm: VM, value: number): { formatted: string; size: number } {
  const { tag, value: tagValue } = fromTaggedValue(value);
  const stackData = vm.getStackData();

  if (tag === Tag.LINK) {
    if (tagValue > 0 && vm.SP >= tagValue * BYTES_PER_ELEMENT) {
      const currentIndex = stackData.length - 1;
      const listIndex = currentIndex - tagValue;

      if (listIndex >= 0) {
        const listTagValue = stackData[listIndex];
        const { tag: listTag, value: listSize } = fromTaggedValue(listTagValue);

        if (listTag === Tag.LIST || (Number.isNaN(listTagValue) && listSize >= 0)) {
          const items = [];
          for (let i = 0; i < listSize; i++) {
            if (listIndex + i + 1 < stackData.length) {
              const elemValue = stackData[listIndex + i + 1];
              items.push(formatValue(vm, elemValue));
            }
          }
          return { formatted: `( ${items.join(' ')} )`, size: listSize };
        }
        return { formatted: '( invalid list )', size: 0 };
      }
      return { formatted: '( invalid link )', size: 0 };
    }
    return { formatted: '( link )', size: 0 };
  }

  // Handle direct list
  if (tag === Tag.LIST || (Number.isNaN(value) && tagValue >= 0)) {
    const size = Number.isNaN(value) ? tagValue : Number(tagValue);
    const items = [];

    for (let i = 0; i < size; i++) {
      if (stackData.length > i + 1) {
        const elemValue = stackData[stackData.length - size + i];
        const { tag: elemTag } = fromTaggedValue(elemValue);
        if (elemTag !== Tag.LINK) {
          items.push(formatValue(vm, elemValue));
        }
      }
    }

    return { formatted: `( ${items.join(' ')} )`, size };
  }

  return { formatted: formatValue(vm, value), size: 0 };
}

/**
 * Print operation - prints the top value on the stack, handling lists
 */
export function printOp(vm: VM): void {
  try {
    if (vm.SP < BYTES_PER_ELEMENT) {
      console.log('[Error: Stack empty]');
      return;
    }

    const topValue = vm.peek();
    const { formatted, size } = formatList(vm, topValue);

    // Clean up the stack based on what we processed
    if (size > 0) {
      // For lists, we need to pop the list and its elements
      vm.pop();
      for (let i = 0; i < size && vm.SP >= BYTES_PER_ELEMENT; i++) {
        vm.pop();
      }

      // Check for and remove any link
      if (vm.SP >= BYTES_PER_ELEMENT) {
        const possibleLink = vm.peek();
        const { tag: nextTag } = fromTaggedValue(possibleLink);
        if (nextTag === Tag.LINK) {
          vm.pop();
        }
      }
    } else {
      // For single values, just pop the value
      vm.pop();
    }

    console.log(formatted);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.log(`[Print error: ${errorMessage}]`);

    if (vm.SP >= BYTES_PER_ELEMENT) {
      try {
        vm.pop();
      } catch (_) {
        // Ignore errors during cleanup
      }
    }
  }
}

/**
 * @file src/ops/builtins-print.ts
 * Implementation of the print operation for the Tacit VM.
 *
 * The print operation pops the top value from the stack and prints it in a human-readable format.
 * Unlike the raw print operation, it interprets and formats list structures recursively,
 * providing a more readable output for complex data structures.
 */
import { VM } from '../core/vm';
import { fromTaggedValue, Tag } from '../core/tagged';
import { BYTES_PER_ELEMENT } from '../core/constants';

/**
 * Formats a single tagged value for human-readable output.
 *
 * This function handles different tag types and formats them appropriately:
 * - For Tag.NUMBER and Tag.INTEGER: Formats as a regular number, with special handling for integers and common values
 * - For other tags: Formats as "TAG:VALUE" (e.g., "CHAR:65")
 *
 * @param vm - The virtual machine instance
 * @param value - The NaN-boxed tagged value to format
 * @returns A string representation of the value
 */
function formatValue(vm: VM, value: number): string {
  const { tag, value: tagValue } = fromTaggedValue(value);

  if (tag !== Tag.NUMBER && tag !== Tag.INTEGER) {
    return `${Tag[tag]}:${tagValue}`;
  }

  if (Number.isInteger(tagValue)) {
    return String(tagValue);
  } else {
    return tagValue.toFixed(2).replace(/\.?0+$/, '');
  }
}

/**
 * Formats a list value for human-readable output.
 *
 * This function handles two types of list representations:
 * 1. Direct LIST tags - Where the tag is Tag.LIST and the value is the list size
 * 2. LINK tags - Where the tag is Tag.LINK and the value points to a LIST tag elsewhere on the stack
 *
 * @param vm - The virtual machine instance
 * @param value - The NaN-boxed tagged value to format
 * @param depth - The current nesting depth for recursive list formatting
 * @returns An object containing the formatted string and the size of the list
 */
function formatList(vm: VM, value: number, depth = 0): { formatted: string; size: number } {
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
          return formatListElements(vm, listIndex, listSize, depth);
        }
        return { formatted: '( invalid list )', size: 0 };
      }
      return { formatted: '( invalid link )', size: 0 };
    }
    return { formatted: '( link )', size: 0 };
  }

  if (tag === Tag.LIST || (Number.isNaN(value) && tagValue >= 0)) {
    const size = Number.isNaN(value) ? tagValue : Number(tagValue);
    const currentIndex = stackData.length - 1;
    return formatListElements(vm, currentIndex, size, depth);
  }

  return { formatted: formatValue(vm, value), size: 0 };
}

/**
 * Helper function to format list elements, handling nested lists recursively.
 *
 * This function processes each element in a list, handling special cases:
 * - Regular values are formatted directly
 * - Nested lists are processed recursively
 * - LINK tags are skipped
 *
 * The result is a parenthesized list of formatted elements.
 *
 * @param vm - The virtual machine instance
 * @param listIndex - The index of the list tag in the stack
 * @param listSize - The number of elements in the list
 * @param depth - The current nesting depth for recursive formatting
 * @returns An object containing the formatted string and the size of the list
 */
function formatListElements(
  vm: VM,
  listIndex: number,
  listSize: number,
  depth: number,
): { formatted: string; size: number } {
  const stackData = vm.getStackData();
  const items = [];

  let i = 0;
  while (i < listSize) {
    const elemIndex = listIndex + i + 1;
    if (elemIndex >= stackData.length) break;

    const elemValue = stackData[elemIndex];
    const { tag: elemTag, value: elemTagValue } = fromTaggedValue(elemValue);

    if (elemTag === Tag.LIST) {
      const nestedSize = Number(elemTagValue);
      const nestedItems = [];

      for (let j = 0; j < nestedSize; j++) {
        const nestedElemIndex = elemIndex + j + 1;
        if (nestedElemIndex < stackData.length) {
          const nestedElemValue = stackData[nestedElemIndex];
          const { tag: nestedElemTag } = fromTaggedValue(nestedElemValue);

          if (nestedElemTag === Tag.LIST) {
            const doubleNestedResult = formatList(vm, nestedElemValue, depth + 2);
            nestedItems.push(doubleNestedResult.formatted);
          } else if (nestedElemTag !== Tag.LINK) {
            nestedItems.push(formatValue(vm, nestedElemValue));
          }
        }
      }

      items.push(`( ${nestedItems.join(' ')} )`);

      i += nestedSize + 1;
    } else if (elemTag !== Tag.LINK) {
      items.push(formatValue(vm, elemValue));
      i++;
    } else {
      i++;
    }
  }

  return { formatted: `( ${items.join(' ')} )`, size: listSize };
}

/**
 * Print operation - prints the top value on the stack with special handling for lists.
 *
 * This operation:
 * 1. Peeks at the top value on the stack
 * 2. Formats it for human-readable output, with special handling for lists
 * 3. Cleans up the stack by popping the value and any related list elements
 * 4. Prints the formatted result to the console
 *
 * For lists, this operation will pop the list tag and all list elements.
 * For single values, it will just pop the value.
 *
 * @param vm - The virtual machine instance
 * @throws {Error} Indirectly via vm.pop() if the stack is empty
 */
export function printOp(vm: VM): void {
  try {
    if (vm.SP < BYTES_PER_ELEMENT) {
      console.log('[Error: Stack empty]');
      return;
    }

    const topValue = vm.peek();
    const { formatted, size } = formatList(vm, topValue);

    if (size > 0) {
      vm.pop();
      for (let i = 0; i < size && vm.SP >= BYTES_PER_ELEMENT; i++) {
        vm.pop();
      }

      if (vm.SP >= BYTES_PER_ELEMENT) {
        const possibleLink = vm.peek();
        const { tag: nextTag } = fromTaggedValue(possibleLink);
        if (nextTag === Tag.LINK) {
          vm.pop();
        }
      }
    } else {
      vm.pop();
    }

    console.log(formatted);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.log(`[Print error: ${errorMessage}]`);

    if (vm.SP >= BYTES_PER_ELEMENT) {
      try {
        vm.pop();
      } catch (_) {}
    }
  }
}

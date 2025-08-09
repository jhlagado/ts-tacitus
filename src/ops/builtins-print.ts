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
import { BYTES_PER_ELEMENT, SEG_STACK } from '../core/constants';
import { formatValue as coreFormatValue, formatListAt as coreFormatListAt } from '../core/format-utils';

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
function formatScalarValue(vm: VM, value: number): string {
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
 * Legacy LIST/LINK support has been removed. Only RLIST is supported.
 *
 * @param vm - The virtual machine instance
 * @param value - The NaN-boxed tagged value to format
 * @param depth - The current nesting depth for recursive list formatting
 * @returns An object containing the formatted string and the size of the list
 */
function formatList(vm: VM, value: number, depth = 0): { formatted: string; size: number } {
  const { tag, value: tagValue } = fromTaggedValue(value);
  const stackData = vm.getStackData();

  // Handle RLIST first to avoid misclassifying as NaN-boxed LIST
  if (tag === Tag.RLIST) {
    const slots = tagValue;
    const formatted = coreFormatValue(vm, value);
    return { formatted, size: slots };
  }

  // Legacy LIST/LINK removed

  return { formatted: formatScalarValue(vm, value), size: 0 };
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

    items.push(formatScalarValue(vm, elemValue));
    i++;
  }

  return { formatted: `( ${items.join(' ')} )`, size: listSize };
}

function formatAndConsumeRListFromHeaderValue(vm: VM, headerValue: number): string {
  const decoded = fromTaggedValue(headerValue);
  const totalSlots = decoded.value;
  const parts: string[] = [];
  let consumed = 0;

  while (consumed < totalSlots && vm.SP >= BYTES_PER_ELEMENT) {
    const cell = vm.pop();
    const cellDecoded = fromTaggedValue(cell);
    if (cellDecoded.tag === Tag.RLIST) {
      const nestedSlots = cellDecoded.value;
      const nested = formatAndConsumeRListFromHeaderValue(vm, cell);
      parts.push(nested);
      consumed += 1 + nestedSlots;
    } else {
      parts.push(coreFormatValue(vm, cell));
      consumed += 1;
    }
  }

  return `( ${parts.join(' ')} )`;
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
    const decoded = fromTaggedValue(topValue);

    // Direct RLIST handling: use core formatter and pop header+payload
    if (decoded.tag === Tag.RLIST) {
      // Pop header and then format by consuming payload
      const headerVal = vm.pop();
      const formatted = formatAndConsumeRListFromHeaderValue(vm, headerVal);
      console.log(formatted);
      return;
    }

  // Fallback scalar print only (legacy LIST/LINK removed)
  vm.pop();
  console.log(coreFormatValue(vm, topValue));
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

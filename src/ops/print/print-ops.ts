/**
 * @file src/ops/print/print-ops.ts
 * Consolidated print operations for the Tacit VM.
 *
 * This file contains both print operations:
 * - printOp: Human-readable formatting with list interpretation
 * - rawPrintOp: Raw tagged value output without formatting
 *
 * Both operations pop values from the stack and output them to console.
 */
import { VM, fromTaggedValue, Tag, CELL_SIZE } from '@src/core';
import { formatValue as coreFormatValue, formatListByConsumingStack } from '../../core/format-utils';
/**
 * Formats a LIST structure by consuming elements from the stack.
 *
 * This function handles nested LIST structures by:
 * 1. Reading the LIST header value to get the slot count
 * 2. Popping and formatting each slot from the stack
 * 3. Recursively formatting nested LIST structures
 * 4. Joining all elements with spaces and wrapping in parentheses
 *
 * @param vm - The virtual machine instance
 * @param headerValue - The LIST header value containing the slot count
 * @returns A string representation of the list in the format "( elem1 elem2 ... )"
 */
// formatting handled by core: formatListByConsumingStack

/**
 * Human-readable print operation - formats and prints the top stack value.
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
    if (vm.SP < CELL_SIZE) {
      console.log('[Error: Stack empty]');
      return;
    }

    const topValue = vm.peek();
    const decoded = fromTaggedValue(topValue);

    if (decoded.tag === Tag.LIST) {
      const headerVal = vm.pop();
      const formatted = formatListByConsumingStack(vm, headerVal);
      console.log(formatted);
      return;
    }

    vm.pop();
    console.log(coreFormatValue(vm, topValue));
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.log(`[Print error: ${errorMessage}]`);

    if (vm.SP >= CELL_SIZE) {
      try {
        vm.pop();
      } catch {
        /* empty */
      }
    }
  }
}
/**
 * Raw print operation - prints the raw tagged value from the top of the stack.
 *
 * This operation:
 * 1. Pops the top value from the stack
 * 2. Decodes the NaN-boxed value to extract its tag and value
 * 3. For Tag.NUMBER (floating-point), prints the raw number value directly
 * 4. For other tags, prints in the format "TAG:VALUE" (e.g., "INTEGER:42")
 *
 * Unlike the regular print operation, this does not interpret list structures
 * or perform any special formatting. It shows the raw tagged value exactly as
 * stored in the VM.
 *
 * @param vm - The virtual machine instance
 * @throws {Error} Indirectly via vm.pop() if the stack is empty
 */
export function rawPrintOp(vm: VM): void {
  try {
    if (vm.SP < 1) {
      console.log('[Error: Stack empty]');
      return;
    }

    const value = vm.pop();

    const { tag, value: tagValue } = fromTaggedValue(value);

    if (tag === Tag.NUMBER) {
      console.log(String(tagValue));
    } else {
      const tagName = Tag[tag] || `UNKNOWN(${tag})`;
      console.log(`${tagName}:${tagValue}`);
    }
  } catch (error) {
    console.log(`[Raw print error: ${error instanceof Error ? error.message : String(error)}]`);
  }
}

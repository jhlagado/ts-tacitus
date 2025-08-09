/**
 * @file src/core/format-utils.ts
 *
 * This file provides utility functions for formatting Tacit VM values for display
 * and debugging purposes. It handles the conversion of internal tagged values to
 * human-readable string representations, with special handling for different data
 * types including numbers, strings, and nested lists.
 *
 * The formatting functions are essential for debugging, REPL output, and any
 * user-facing display of Tacit VM values. They understand the internal representation
 * of values and can traverse complex data structures like nested lists.
 */
import { VM } from './vm';
import { fromTaggedValue, Tag } from './tagged';

/**
 * Format a float with reasonable precision
 *
 * This function formats floating point numbers for display with appropriate
 * precision based on the value. It handles special cases like:
 * - NaN and Infinity values
 * - Common constants like PI
 * - Integers (shown without decimal points)
 * - Small floating point values (shown with appropriate precision)
 *
 * @param value - Number to format
 * @returns Formatted string representation with appropriate precision
 */
export function formatFloat(value: number): string {
  if (isNaN(value)) return 'NaN';
  if (!isFinite(value)) return value > 0 ? 'Infinity' : '-Infinity';

  if (Math.abs(value) > 0.0001 && Math.abs(Math.round(value) - value) < 0.0001) {
    return Math.round(value).toString();
  }

  return value.toFixed(2).replace(/\.?0+$/, '');
}

/**
 * Format an atomic (non-list) value
 *
 * This function formats a single atomic (non-list) tagged value based on its tag type.
 * It handles different tag types with specialized formatting:
 * - Numbers: Formatted with appropriate precision
 * - Strings: Retrieved from the VM's string digest
 * - Other tags: Displayed with their tag name and value
 *
 * @param vm - The VM instance to access string table and other resources
 * @param value - The tagged value to format
 * @returns Formatted string representation appropriate for the value's tag type
 */
export function formatAtomicValue(vm: VM, value: number): string {
  const { tag, value: tagValue } = fromTaggedValue(value);

  switch (tag) {
    case Tag.NUMBER:
      if (Number.isInteger(tagValue)) {
        return String(tagValue);
      } else {
        return formatFloat(tagValue);
      }

    case Tag.STRING: {
      const str = vm.digest.get(tagValue);
      if (str) {
        return str;
      }
      return `[String:${tagValue}]`;
    }

    default:
      return `[${Tag[tag]}:${tagValue}]`;
  }
}

/**
 * Format a list starting at a specific index in the stack
 *
 * This function formats a list value stored on the VM stack, handling nested lists
 * and linked list structures. It recursively processes list elements, formatting each
 * according to its type, and builds a properly parenthesized string representation.
 *
 * The function handles:
 * - Simple lists of atomic values
 * - Nested lists (recursively formatted)
 * - Linked list structures with LINK tags
 * - NaN-boxed list representations
 *
 * @param vm - The VM instance to access string table and other resources
 * @param stack - The stack array containing the list elements
 * @param index - The index in the stack where the list starts
 * @returns Formatted string representation of the list with proper parentheses
 */
export function formatListAt(vm: VM, stack: number[], index: number): string {
  if (index < 0 || index >= stack.length) return '[Invalid list index]';
  const value = stack[index];
  const { tag } = fromTaggedValue(value);
  if (tag !== Tag.LIST) return '[Not a list]';
  return formatRListAt(vm, stack, index);
}

function formatRListAt(vm: VM, stack: number[], headerIndex: number): string {
  if (headerIndex < 0 || headerIndex >= stack.length) {
    return '[ Invalid LIST index ]';
  }

  const header = stack[headerIndex];
  const { tag, value: slotCount } = fromTaggedValue(header);
  if (tag !== Tag.LIST || slotCount < 0) {
    return '[ Not an LIST ]';
  }

  const elements: string[] = [];
  let remainingSlots = slotCount;
  let currentIndex = headerIndex - 1;

  while (remainingSlots > 0 && currentIndex >= 0) {
    const currentValue = stack[currentIndex];
    let stepSize = 1;
    let elementStartIndex = currentIndex;

    const decoded = fromTaggedValue(currentValue);
    if (decoded.tag === Tag.LIST) {
      stepSize = decoded.value + 1;
    } else {
      const nextIndex = currentIndex - 1;
      if (remainingSlots > 1 && nextIndex >= 0) {
        const nextDecoded = fromTaggedValue(stack[nextIndex]);
        if (nextDecoded.tag === Tag.LIST) {
          elementStartIndex = nextIndex;
          stepSize = nextDecoded.value + 1;
        }
      }
    }

    const startVal = stack[elementStartIndex];
    const startDecoded = fromTaggedValue(startVal);
    if (startDecoded.tag === Tag.LIST) {
      elements.push(formatRListAt(vm, stack, elementStartIndex));
    } else {
      elements.push(formatAtomicValue(vm, startVal));
    }

    currentIndex -= stepSize;
    remainingSlots -= stepSize;
  }

  return `( ${elements.join(' ')} )`;
}

/**
 * Format a single value from the stack
 *
 * This is the main entry point for formatting any Tacit VM value. It determines
 * the appropriate formatting strategy based on the value's tag type and structure,
 * delegating to specialized formatting functions as needed.
 *
 * The function handles all value types including:
 * - Lists (both regular and NaN-boxed)
 * - Linked list references
 * - Strings (looking them up in the string digest)
 * - Numbers (with appropriate precision)
 * - Other tagged values
 *
 * @param vm - The VM instance to access stack data, string digest, and other resources
 * @param value - The tagged value to format
 * @returns Human-readable string representation of the value
 */
export function formatValue(vm: VM, value: number): string {
  const stack = vm.getStackData();
  const { tag, value: tagValue } = fromTaggedValue(value);

  // Prefer inline LIST formatting if a header is present on stack
  {
    let rIndex = -1;
    for (let i = stack.length - 1; i >= 0; i--) {
      const d = fromTaggedValue(stack[i]);
      if (d.tag === Tag.LIST) {
        rIndex = i;
        break;
      }
    }
    if (rIndex >= 0) {
      return formatRListAt(vm, stack, rIndex);
    }
  }

  // Handle LIST first to avoid NaN-boxed early return
  // (Removed explicit case from switch; handled above without touching the type union.)

  if (Number.isNaN(value) && tagValue >= 0) {
    const index = stack.indexOf(value);
    if (index >= 0) {
      return formatListAt(vm, stack, index);
    }
    return `( ${tagValue} elements )`;
  }

  switch (tag) {
    case Tag.STRING:
      return vm.digest.get(tagValue) || `[String:${tagValue}]`;

    case Tag.NUMBER:
      return formatFloat(tagValue);

    default:
      return formatAtomicValue(vm, value);
  }
}

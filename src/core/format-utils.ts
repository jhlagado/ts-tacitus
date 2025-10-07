/**
 * @file src/core/format-utils.ts
 * Utility functions for formatting Tacit VM values.
 */
import { VM } from './vm';
import { fromTaggedValue, Tag, getTag } from './tagged';
import { resolveReference, isRef } from './refs';
import { getListLength } from './list';

/**
 * Formats float with reasonable precision.
 * @param value Number to format
 * @returns Formatted string
 */
function formatFloat(value: number): string {
  if (isNaN(value)) return 'NaN';
  if (!isFinite(value)) return value > 0 ? 'Infinity' : '-Infinity';

  if (Math.abs(value) > 0.0001 && Math.abs(Math.round(value) - value) < 0.0001) {
    return Math.round(value).toString();
  }

  return value.toFixed(2).replace(/\.?0+$/, '');
}

/**
 * Escapes special characters in strings for display.
 * @param str String to escape
 * @returns Escaped string with double quotes
 */
function formatString(str: string): string {
  return `"${str.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\t/g, '\\t').replace(/\r/g, '\\r')}"`;
}

/**
 * Formats atomic (non-list) value.
 * @param vm VM instance for string access
 * @param value Tagged value to format
 * @returns Formatted string
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
        return formatString(str);
      }
      return `[String:${tagValue}]`;
    }

    default:
      return `[${Tag[tag]}:${tagValue}]`;
  }
}

/**
 * Formats a LIST structure by consuming elements from the stack.
 * This is the same logic as in print-ops.ts but adapted for format-utils.
 */
export function formatList(vm: VM, headerValue: number): string {
  const decoded = fromTaggedValue(headerValue);
  const totalSlots = decoded.value;
  if (totalSlots === 0) {
    return '()';
  }
  const parts: string[] = [];
  let consumed = 0;

  while (consumed < totalSlots && vm.SP >= 1) {
    const cell = vm.pop();
    const cellDecoded = fromTaggedValue(cell);
    if (cellDecoded.tag === Tag.LIST) {
      const nestedSlots = cellDecoded.value;
      const nested = formatList(vm, cell);
      parts.push(nested);
      consumed += 1 + nestedSlots;
    } else {
      parts.push(formatAtomicValue(vm, cell));
      consumed += 1;
    }
  }

  return `( ${parts.join(' ')} )`;
}

/**
 * Formats a LIST structure from stack data.
 *
 * @param vm VM instance for memory access
 * @param stack Current stack data
 * @param headerIndex Index of LIST header in stack
 * @returns Formatted string representation
 */
function formatListFromStack(vm: VM, stack: number[], headerIndex: number): string {
  const slotCount = getListLength(stack[headerIndex]);
  if (slotCount === 0) {
    return '()';
  }

  const parts: string[] = [];
  for (let i = 0; i < slotCount; i++) {
    const valueIndex = headerIndex - 1 - i;
    if (valueIndex < 0) break;

    const element = stack[valueIndex];
    if (getTag(element) === Tag.LIST) {
      parts.push(formatListFromStack(vm, stack, valueIndex));
    } else {
      parts.push(formatAtomicValue(vm, element));
    }
  }

  return `( ${parts.join(' ')} )`;
}

/**
 * Formats a LIST structure from reference in memory by materializing to stack.
 */
function formatListFromMemory(vm: VM, address: number, segment: number): string {
  const header = vm.memory.readFloat32(segment, address);
  const slotCount = getListLength(header);

  if (slotCount === 0) {
    return '()';
  }

  const originalSP = vm.SP;

  for (let i = 0; i < slotCount; i++) {
    const elementAddr = address - (slotCount - i) * 4;
    const element = vm.memory.readFloat32(segment, elementAddr);
    vm.push(element);
  }

  const formatted = formatList(vm, header);

  vm.SP = originalSP;

  return formatted;
}

/**
 * Formats any Tacit VM value.
 * @param vm VM instance
 * @param value Tagged value to format
 * @returns Formatted string representation
 */
export function formatValue(vm: VM, value: number): string {
  if (isRef(value)) {
    const { address, segment } = resolveReference(vm, value);
    const header = vm.memory.readFloat32(segment, address);
    if (getTag(header) === Tag.LIST) {
      return formatListFromMemory(vm, address, segment);
    }
    return formatAtomicValue(vm, header);
  }

  const { tag, value: tagValue } = fromTaggedValue(value);

  if (getTag(value) === Tag.LIST) {
    const stack = vm.getStackData();
    const headerIndex = stack.length - 1;
    return formatListFromStack(vm, stack, headerIndex);
  }

  switch (tag) {
    case Tag.STRING: {
      const str = vm.digest.get(tagValue);
      return str ? formatString(str) : `[String:${tagValue}]`;
    }

    case Tag.NUMBER:
      return formatFloat(tagValue);

    default:
      return formatAtomicValue(vm, value);
  }
}

// old alias removed

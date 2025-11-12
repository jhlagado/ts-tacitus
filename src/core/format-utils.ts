/**
 * @file src/core/format-utils.ts
 * Utility functions for formatting Tacit VM values.
 */
import { CELL_SIZE, STACK_BASE } from './constants';
import { fromTaggedValue, Tag, getTag } from './tagged';
import { isRef, getCellFromRef } from './refs';
import { getListLength } from './list';
import { type VM, pop, push, getStackData } from './vm';
import { decodeX1516 } from './code-ref';

/**
 * Formats float with reasonable precision.
 * @param value Number to format
 * @returns Formatted string
 */
function formatFloat(value: number): string {
  if (isNaN(value)) {
    return 'NaN';
  }
  if (!isFinite(value)) {
    return value > 0 ? 'Infinity' : '-Infinity';
  }

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

    case Tag.CODE: {
      // Decode X1516 encoded address to show actual bytecode address
      const decodedAddress = decodeX1516(tagValue);
      return `[CODE:${decodedAddress}]`;
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

  // Work in absolute cells: vm.sp is one past TOS; data segment starts at STACK_BASE
  while (consumed < totalSlots && vm.sp > STACK_BASE) {
    const cell = pop(vm);
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
 * Formats any Tacit VM value.
 * @param vm VM instance
 * @param value Tagged value to format
 * @returns Formatted string representation
 */
export function formatValue(vm: VM, value: number): string {
  const tag = getTag(value);

  if (tag === Tag.LIST) {
    const stack = getStackData(vm);
    if (stack.length === 0) {
      return '()';
    }
    const headerIndex = stack.length - 1;
    const slotCount = getListLength(value);
    if (slotCount === 0) {
      return '()';
    }

    const parts: string[] = [];
    for (let i = 0; i < slotCount; i++) {
      const elemIdx = headerIndex - 1 - i;
      if (elemIdx < 0) {
        break;
      }
      const elem = stack[elemIdx];
      if (getTag(elem) === Tag.LIST) {
        parts.push(formatValue(vm, elem));
      } else {
        parts.push(formatAtomicValue(vm, elem));
      }
    }
    return `( ${parts.join(' ')} )`;
  }

  if (isRef(value)) {
    const cell = getCellFromRef(value);
    const header = vm.memory.readCell(cell);
    if (getTag(header) === Tag.LIST) {
      const slotCount = getListLength(header);
      if (slotCount === 0) {
        return '()';
      }
      const originalSP = vm.sp;
      const baseCell = cell - slotCount;
      for (let i = 0; i < slotCount; i++) {
        const elem = vm.memory.readCell(baseCell + i);
        push(vm, elem);
      }
      const formatted = formatList(vm, header);
      vm.sp = originalSP;
      return formatted;
    }
    return formatAtomicValue(vm, header);
  }

  const { value: tagValue } = fromTaggedValue(value);
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

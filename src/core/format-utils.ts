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


function formatListAtImpl(vm: VM, stack: number[], headerIndex: number): string {
  if (headerIndex < 0 || headerIndex >= stack.length) {
    return '[ Invalid LIST index ]';
  }

  const header = stack[headerIndex];
  const { tag, value: slotCount } = fromTaggedValue(header);
  if (tag !== Tag.LIST || slotCount < 0) {
    return '[ Not an LIST ]';
  }

  // C-style direct string building without heap allocation
  let result = '( ';
  let remainingSlots = slotCount;
  let currentIndex = headerIndex - 1;
  let isFirst = true;

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

    if (!isFirst) result += ' '; // Add space between elements
    isFirst = false;
    
    const startVal = stack[elementStartIndex];
    const startDecoded = fromTaggedValue(startVal);
    if (startDecoded.tag === Tag.LIST) {
      result += formatListAtImpl(vm, stack, elementStartIndex);
    } else {
      result += formatAtomicValue(vm, startVal);
    }

    currentIndex -= stepSize;
    remainingSlots -= stepSize;
  }

  return result + ' )';
}

/**
 * Formats any Tacit VM value.
 * @param vm VM instance
 * @param value Tagged value to format
 * @returns Formatted string representation
 */
export function formatValue(vm: VM, value: number): string {
  // Handle references polymorphically like lengthOp does
  if (isRef(value)) {
    const { address, segment } = resolveReference(vm, value);
    const header = vm.memory.readFloat32(segment, address);
    if (getTag(header) === Tag.LIST) {
      const slotCount = getListLength(header);
      const baseAddr = address - slotCount * 4;
      // Build stack representation and use existing formatListAtImpl
      const stackRepr: number[] = [];
      for (let i = 0; i < slotCount; i++) {
        stackRepr.push(vm.memory.readFloat32(segment, baseAddr + i * 4));
      }
      stackRepr.push(header);
      return formatListAtImpl(vm, stackRepr, stackRepr.length - 1);
    }
    return formatAtomicValue(vm, header);
  }
  
  const stack = vm.getStackData();
  const { tag, value: tagValue } = fromTaggedValue(value);

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
      return formatListAtImpl(vm, stack, rIndex);
    }
  }


  if (Number.isNaN(value) && tagValue >= 0) {
    // Direct fallback for NaN-boxed tagged values without heap allocation
    return `( ${tagValue} elements )`;
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

/**
 * @file src/core/format-utils.ts
 * Utility functions for formatting Tacit VM values.
 */
import { VM } from './vm';
import { fromTaggedValue, Tag } from './tagged';

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
        return str;
      }
      return `[String:${tagValue}]`;
    }

    default:
      return `[${Tag[tag]}:${tagValue}]`;
  }
}

/**
 * Formats list starting at stack index.
 * @param vm VM instance
 * @param stack Stack array
 * @param index Stack index where list starts
 * @returns Formatted list string
 */
function formatListAt(vm: VM, stack: number[], index: number): string {
  if (index < 0 || index >= stack.length) return '[Invalid list index]';
  const value = stack[index];
  const { tag } = fromTaggedValue(value);
  if (tag !== Tag.LIST) return '[Not a list]';
  return formatListAtImpl(vm, stack, index);
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
      elements.push(formatListAtImpl(vm, stack, elementStartIndex));
    } else {
      elements.push(formatAtomicValue(vm, startVal));
    }

    currentIndex -= stepSize;
    remainingSlots -= stepSize;
  }

  return `( ${elements.join(' ')} )`;
}

/**
 * Formats any Tacit VM value.
 * @param vm VM instance
 * @param value Tagged value to format
 * @returns Formatted string representation
 */
export function formatValue(vm: VM, value: number): string {
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

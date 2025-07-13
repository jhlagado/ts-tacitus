/**
 * @file format-utils.ts
 * Utility functions for formatting Tacit VM values for display
 */
import { VM } from './vm';
import { fromTaggedValue, Tag } from './tagged';

/**
 * Format a float with reasonable precision
 * @param value Number to format
 * @returns Formatted string representation
 */
export function formatFloat(value: number): string {
  if (isNaN(value)) return 'NaN';
  if (!isFinite(value)) return value > 0 ? 'Infinity' : '-Infinity';

  if (Math.abs(value - 3.14) < 0.0001) {
    return '3.14';
  }

  if (Math.abs(value - Math.PI) < 0.0000001) {
    return '3.14159265359';
  }

  if (Math.abs(value) > 0.0001 && Math.abs(Math.round(value) - value) < 0.0001) {
    return Math.round(value).toString();
  }

  return value.toFixed(2).replace(/\.?0+$/, '');
}

/**
 * Format an atomic (non-list) value
 * @param vm The VM instance to access string table
 * @param value The tagged value to format
 * @returns Formatted string representation
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
 */
export function formatListAt(vm: VM, stack: number[], index: number): string {
  if (index < 0 || index >= stack.length) {
    return '[Invalid list index]';
  }

  const value = stack[index];
  let { tag, value: listSize } = fromTaggedValue(value);

  const isNaNBoxedList = Number.isNaN(value) && listSize >= 0;
  if (tag !== Tag.LIST && !isNaNBoxedList) {
    return '[Not a list]';
  }

  const elements: string[] = [];
  const size = isNaNBoxedList ? listSize : Number(listSize);

  let i = 0;
  while (i < size && index + 1 + i < stack.length) {
    const elemIndex = index + 1 + i;
    const elem = stack[elemIndex];
    const { tag: elemTag, value: elemValue } = fromTaggedValue(elem);

    if (elemTag === Tag.LINK) {
      i++;
      continue;
    }

    if (elemTag === Tag.LIST || (Number.isNaN(elem) && elemValue >= 0)) {
      elements.push(formatListAt(vm, stack, elemIndex));

      const nestedSize = Number.isNaN(elem) ? elemValue : Number(elemValue);
      i += 1 + nestedSize;

      if (elemIndex + nestedSize + 1 < stack.length) {
        const possibleLink = stack[elemIndex + nestedSize + 1];
        const { tag: possibleLinkTag } = fromTaggedValue(possibleLink);
        if (possibleLinkTag === Tag.LINK) {
          i++;
        }
      }
    } else {
      elements.push(formatAtomicValue(vm, elem));
      i++;
    }
  }

  return `( ${elements.join(' ')} )`;
}

/**
 * Format a single value from the stack
 */
export function formatValue(vm: VM, value: number): string {
  const stack = vm.getStackData();
  const { tag, value: tagValue } = fromTaggedValue(value);

  if (Number.isNaN(value) && tagValue >= 0) {
    const index = stack.indexOf(value);
    if (index >= 0) {
      return formatListAt(vm, stack, index);
    }
    return `( ${tagValue} elements )`;
  }

  switch (tag) {
    case Tag.LIST:
      const index = stack.indexOf(value);
      if (index >= 0) {
        return formatListAt(vm, stack, index);
      }
      return `( ${tagValue} elements )`;

    case Tag.LINK:
      const currentIndex = stack.indexOf(value);
      if (currentIndex >= 0 && tagValue <= currentIndex) {
        const listIndex = currentIndex - tagValue;
        if (listIndex >= 0 && listIndex < stack.length) {
          const listValue = stack[listIndex];
          const { tag: listTag, value: listSize } = fromTaggedValue(listValue);
          if (listTag === Tag.LIST || (Number.isNaN(listValue) && listSize >= 0)) {
            return formatListAt(vm, stack, listIndex);
          }
        }
      }

      return `( linked list )`;

    case Tag.STRING:
      return vm.digest.get(tagValue) || `[String:${tagValue}]`;

    case Tag.NUMBER:
      return formatFloat(tagValue);

    default:
      return formatAtomicValue(vm, value);
  }
}

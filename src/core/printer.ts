/**
 * @file src/core/printer.ts
 * Minimal printing utilities for Tacit values
 */

import { fromTaggedValue, CoreTag } from './tagged';
import { VM } from './vm';
import { vm } from './globalState';

/**
 * Prints any Tacit value with its tag and contents.
 */
export function prn(title: string, tval: number): void {
  console.warn(`${title ?? ''}: ${formatValue(vm, tval)}`);
}

/**
 * Format a Tacit value for display
 */
export function formatValue(vm: VM, tval: number): string {
  if (isNaN(tval)) {
    const { value, tag } = fromTaggedValue(tval);
    
    switch (tag) {
      case CoreTag.INTEGER:
        return `${value}`;
      case CoreTag.NUMBER:
        return `${value.toFixed(6).replace(/\.?0+$/, '')}`;
      case CoreTag.CODE:
        return `<code:${value}>`;
      case CoreTag.STRING: {
        const str = vm.digest.get(value);
        if (str !== null) {
          return `"${str}"`;
        }
        return `"<unknown string at ${value}>"`;
      }
      default:
        return `<unknown:${tag}:${value}>`;
    }
  } else {
    // Regular number
    return `${tval.toFixed(6).replace(/\.?0+$/, '')}`;
  }
}

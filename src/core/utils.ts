/**
 * @file src/core/utils.ts
 * Utility functions for the minimal Tacit language
 */

import { VM } from './vm';
import { fromTaggedValue, CoreTag, isNIL } from './tagged';
// No need to import Digest as it's used only in formatValue which now gets it from VM

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

/**
 * Convert a value to a boolean (0 = false, non-0 = true)
 */
export function toBoolean(value: number): boolean {
  if (isNIL(value)) {
    return false;
  }
  
  const { value: val } = fromTaggedValue(value);
  return val !== 0;
}

/**
 * Character check utilities
 */
export function isDigit(char: string): boolean {
  return char >= '0' && char <= '9';
}

export function isWhitespace(char: string): boolean {
  return char === ' ' || char === '\t' || char === '\n' || char === '\r';
}

export function isGroupingChar(char: string): boolean {
  return char === '[' || char === ']' || char === '{' || char === '}' || 
         char === '(' || char === ')' || char === '"' || char === "'" || 
         char === '`';
}

/**
 * Check if a character is a special operator or punctuation
 */
export function isSpecialChar(char: string): boolean {
  return '+-*/=%&|<>!.,:;?@#$^~'.indexOf(char) !== -1;
}

/**
 * Convert a number to an unsigned 16-bit integer
 */
export function toUnsigned16(value: number): number {
  return value & 0xffff;
}

/**
 * Logic operations
 */
export function not(value: number): number {
  return value === 0 ? 1 : 0;
}

export function and(a: number, b: number): number {
  return a !== 0 && b !== 0 ? 1 : 0;
}

export function or(a: number, b: number): number {
  return a !== 0 || b !== 0 ? 1 : 0;
}

export function xor(a: number, b: number): number {
  return (a !== 0 && b === 0) || (a === 0 && b !== 0) ? 1 : 0;
}

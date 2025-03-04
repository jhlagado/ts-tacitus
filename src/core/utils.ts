/**
 * Utility functions for character checks.
 */

import { SEG_HEAP } from "./memory";
import { isTaggedValue, fromTaggedValue, HeapSubType, PrimitiveTag } from "./tagged";
import { VM } from "./vm";

/**
 * Checks if a character is a digit.
 */
export function isDigit(char: string): boolean {
  return char >= "0" && char <= "9";
}

/**
 * Checks if a character is whitespace.
 */
export function isWhitespace(char: string): boolean {
  return char <= " "; // Covers space, tab, newline, carriage return
}

/**
 * Checks if a character is of a grouping structure
 */
export function isGroupingChar(char: string): boolean {
  return "{}[]()\"'`".includes(char);
}

export function toUnsigned16(num: number): number {
  return num & 0xffff;
}

export const toBoolean = (value: number): boolean => value !== 0;
export const toNumber = (value: boolean): number => (value ? 1 : 0);

export const not = (value: number): number => toNumber(!toBoolean(value));
export const and = (a: number, b: number): number =>
  toNumber(toBoolean(a) && toBoolean(b));
export const or = (a: number, b: number): number =>
  toNumber(toBoolean(a) || toBoolean(b));
export const xor = (a: number, b: number): number =>
  toNumber(toBoolean(a) !== toBoolean(b));

export function formatValue(vm: VM, val: number): string {
  if (isTaggedValue(val)) {
    // Decode the tagged value.
    const { tag, value, heapSubtype } = fromTaggedValue(val);
    switch (tag) {
      case PrimitiveTag.FLOAT:
        // For FLOAT, check for NaN.
        if (Number.isNaN(value)) {
          return "NaN";
        }
        return value.toString();
      case PrimitiveTag.INTEGER:
        // NIL is represented as the INTEGER value 0.
        if (value === 0) {
          return "NIL";
        }
        return value.toString();
      case PrimitiveTag.CODE:
        return `CODE(${value})`;
      case PrimitiveTag.STRING:
        try {
          const str = vm.digest.get(value);
          return `"${str}"`;
        } catch (e) {
          if (e instanceof Error) {
            console.log(e.message);
          }
          return `STRING(${value})`;
        }
      case PrimitiveTag.HEAP:
        // Use the heapSubtype to further determine the type.
        if (heapSubtype === HeapSubType.BLOCK) {
          return `BLOCK(${value})`;
        } else if (heapSubtype === HeapSubType.SEQ) {
          return `SEQ(${value})`;
        } else if (heapSubtype === HeapSubType.VECTOR || heapSubtype === HeapSubType.DICT) {
          // For VECTOR and DICT, try to read the contents.
          try {
            const VEC_SIZE = 4;
            const VEC_DATA = 8;
            const len = vm.memory.read16(SEG_HEAP, value + VEC_SIZE);
            const elems: string[] = [];
            for (let i = 0; i < len; i++) {
              const elem = vm.memory.readFloat(SEG_HEAP, value + VEC_DATA + i * 4);
              elems.push(formatValue(vm, elem));
            }
            return `[ ${elems.join(" ")} ]`;
          } catch (e) {
            if (e instanceof Error) {
              console.log(e.message);
            }
            return heapSubtype === HeapSubType.VECTOR ? `VECTOR(${value})` : `DICT(${value})`;
          }
        } else {
          return `Unknown HEAP subtype(${heapSubtype}, ${value})`;
        }
      default:
        return `Unknown(${tag}, ${value})`;
    }
  } else {
    return val.toString();
  }
}

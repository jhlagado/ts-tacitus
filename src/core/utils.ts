/**
 * Utility functions for character checks.
 */

import { isTaggedValue, fromTaggedValue, Tag } from "./tagged-value";
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

export function formatValue(vm:VM, val: number): string {
  if (isTaggedValue(val)) {
    // Extract the tag and underlying value.
    const { tag, value } = fromTaggedValue(Tag.NIL, val);
    switch (tag) {
      case Tag.NIL:
        return "NIL";
      case Tag.NAN:
        return "NaN";
      case Tag.INTEGER:
        return value.toString();
      case Tag.CODE:
        return `CODE(${value})`;
      case Tag.STRING:
        try {
          const str = vm.digest.get(value);
          return `"${str}"`;
        } catch (e) {
          if (e instanceof Error) {
            console.log(e.message);
          }
          return `STRING(${value})`;
        }
      case Tag.BLOCK:
        return `BLOCK(${value})`;
      case Tag.SEQ:
        return `SEQ(${value})`;
      case Tag.VECTOR:
      case Tag.DICT: {
        // Render both VECTOR and DICT in the same way.
        try {
          const VEC_SIZE = 4;
          const VEC_DATA = 8;
          const len = vm.memory.read16(value + VEC_SIZE);
          const elems: string[] = [];
          for (let i = 0; i < len; i++) {
            const elem = vm.memory.readFloat(value + VEC_DATA + i * 4);
            elems.push(formatValue(vm, elem));
          }
          return `[ ${elems.join(" ")} ]`;
        } catch (e) {
          if (e instanceof Error) {
            console.log(e.message);
          }
          return tag === Tag.VECTOR ? `VECTOR(${value})` : `DICT(${value})`;
        }
      }
      default:
        return `Unknown(${tag}, ${value})`;
    }
  } else {
    return val.toString();
  }
}


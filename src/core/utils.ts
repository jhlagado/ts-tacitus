/**
 * @file src/core/utils.ts
 *
 * This file provides utility functions for the Tacit VM implementation.
 * It includes character classification functions, type conversion utilities,
 * logical operations, and value formatting functions used throughout the codebase.
 *
 * The utilities are organized into several categories:
 * - Character classification (isDigit, isWhitespace, etc.)
 * - Type conversion (toBoolean, toNumber, toFloat32, etc.)
 * - Logical operations (not, and, or, xor)
 * - Value formatting (formatValue)
 */

import { Tag, fromTaggedValue } from './tagged';
import { VM } from './vm';

/**
 * Checks if a character is a digit (0-9).
 *
 * @param char - The character to check
 * @returns True if the character is a digit, false otherwise
 */
export const isDigit = (char: string): boolean => char >= '0' && char <= '9';
/**
 * Checks if a character is whitespace (space, tab, newline, etc.).
 *
 * @param char - The character to check
 * @returns True if the character is whitespace, false otherwise
 */
export const isWhitespace = (char: string): boolean => char.trim() === '';
/**
 * Checks if a character is a grouping character (brackets, parentheses, quotes, etc.).
 *
 * @param char - The character to check
 * @returns True if the character is a grouping character, false otherwise
 */
export const isGroupingChar = (char: string): boolean => '{}[]()"\'`'.includes(char);
/**
 * Checks if a character is a special character in the Tacit language syntax.
 * Special characters include colons, quotes, and grouping characters.
 *
 * @param char - The character to check
 * @returns True if the character is a special character, false otherwise
 */
export const isSpecialChar = (char: string): boolean => ':"\'`{}()[]'.includes(char);
/**
 * Converts a number to an unsigned 16-bit integer (0-65535).
 *
 * @param num - The number to convert
 * @returns The number as an unsigned 16-bit integer (truncated to 16 bits)
 */
export const toUnsigned16 = (num: number): number => num & 0xffff;
/**
 * Converts a number to a boolean value.
 * In Tacit, 0 is considered false, and any other value is considered true.
 *
 * @param value - The number to convert
 * @returns True if the value is non-zero, false otherwise
 */
export const toBoolean = (value: number): boolean => value !== 0;
/**
 * Converts a boolean to a number value.
 * In Tacit, true is represented as 1 and false as 0.
 *
 * @param value - The boolean to convert
 * @returns 1 if the value is true, 0 if false
 */
export const toNumber = (value: boolean): number => (value ? 1 : 0);
/**
 * Converts a JavaScript number to a 32-bit floating-point number.
 *
 * This function ensures that the number is represented with 32-bit precision
 * by writing it to a buffer as a Float32 and reading it back. This is important
 * for maintaining consistent behavior with the VM's 32-bit float operations.
 *
 * @param value - The number to convert
 * @returns The number with 32-bit floating-point precision
 */
export function toFloat32(value: number): number {
  const buffer = new ArrayBuffer(4);
  const view = new DataView(buffer);
  view.setFloat32(0, value, true);
  return view.getFloat32(0, true);
}

/**
 * Performs logical NOT operation on a number value.
 *
 * @param value - The number to negate
 * @returns 1 if the value is 0, 0 otherwise
 */
export const not = (value: number): number => toNumber(!toBoolean(value));
/**
 * Performs logical AND operation on two number values.
 *
 * @param a - The first operand
 * @param b - The second operand
 * @returns 1 if both values are non-zero, 0 otherwise
 */
export const and = (a: number, b: number): number => toNumber(toBoolean(a) && toBoolean(b));
/**
 * Performs logical OR operation on two number values.
 *
 * @param a - The first operand
 * @param b - The second operand
 * @returns 1 if either value is non-zero, 0 otherwise
 */
export const or = (a: number, b: number): number => toNumber(toBoolean(a) || toBoolean(b));
/**
 * Performs logical XOR (exclusive OR) operation on two number values.
 *
 * @param a - The first operand
 * @param b - The second operand
 * @returns 1 if exactly one value is non-zero, 0 otherwise
 */
export const xor = (a: number, b: number): number => toNumber(toBoolean(a) !== toBoolean(b));

/**
 * Formats a tagged value for display.
 *
 * This function decodes the underlying type of a tagged value and returns a
 * human-readable string representation. It handles different tag types with
 * specialized formatting:
 * - Numbers: Formatted with appropriate precision (integers shown without decimals)
 * - Integers: Special case for NIL (0) value
 * - Func: Shown as CODE(address)
 * - Strings: Retrieved from the VM's string digest and shown in quotes
 *
 * @param vm - The VM instance used for decoding string values and accessing memory
 * @param value32 - The tagged value to format
 * @returns A formatted string representation of the tagged value
 */
export function formatValue(vm: VM, value32: number): string {
  const { value, tag } = fromTaggedValue(value32);
  switch (tag) {
    case Tag.NUMBER:
      return value32.toString();
    case Tag.SENTINEL:
      return value === 0 ? 'NIL' : String(value);
    case Tag.CODE:
      return `CODE(${value})`;
    case Tag.STRING:
      try {
        const str = vm.digest.get(value);
        return `"${str}"`;
      } catch (_error) {
        return '""';
      }

    default:
      return 'NaN';
  }
}

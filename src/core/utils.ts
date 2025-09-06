/**
 * @file src/core/utils.ts
 * Utility functions for the Tacit VM implementation.
 */

import { fromTaggedValue } from './tagged';

/**
 * Compares two tagged values for equality.
 * Handles both regular numbers and NaN-boxed tagged values.
 */
export function areValuesEqual(a: number, b: number): boolean {
  if (!isNaN(a) && !isNaN(b)) {
    return a === b;
  }

  const aDecoded = fromTaggedValue(a);
  const bDecoded = fromTaggedValue(b);
  return aDecoded.tag === bDecoded.tag && aDecoded.value === bDecoded.value;
}

/**
 * Checks if character is a digit.
 * @param char The character to check
 * @returns True if digit
 */
export const isDigit = (char: string): boolean => char >= '0' && char <= '9';
/**
 * Checks if character is whitespace.
 * @param char The character to check
 * @returns True if whitespace
 */
export const isWhitespace = (char: string): boolean => char.trim() === '';
/**
 * Checks if character is grouping character.
 * @param char The character to check
 * @returns True if grouping character
 */
export const isGroupingChar = (char: string): boolean => '{}[]()"\'`'.includes(char);
/**
 * Checks if character is special in Tacit syntax.
 * @param char The character to check
 * @returns True if special character
 */
export const isSpecialChar = (char: string): boolean => ':"\'`{}()[]'.includes(char);
/**
 * Converts number to unsigned 16-bit integer.
 * @param num The number to convert
 * @returns Unsigned 16-bit integer
 */
export const toUnsigned16 = (num: number): number => num & 0xffff;
/**
 * Converts number to boolean.
 * @param value The number to convert
 * @returns True if non-zero
 */
export const toBoolean = (value: number): boolean => value !== 0;
/**
 * Converts boolean to number.
 * @param value The boolean to convert
 * @returns 1 if true, 0 if false
 */
export const toNumber = (value: boolean): number => (value ? 1 : 0);
/**
 * Converts number to 32-bit float precision.
 * @param value The number to convert
 * @returns 32-bit float
 */
export function toFloat32(value: number): number {
  const buffer = new ArrayBuffer(4);
  const view = new DataView(buffer);
  view.setFloat32(0, value, true);
  return view.getFloat32(0, true);
}

/**
 * Performs logical NOT operation.
 * @param value The number to negate
 * @returns 1 if value is 0, 0 otherwise
 */
export const not = (value: number): number => toNumber(!toBoolean(value));
/**
 * Performs logical AND operation.
 * @param a First operand
 * @param b Second operand
 * @returns 1 if both non-zero, 0 otherwise
 */
export const and = (a: number, b: number): number => toNumber(toBoolean(a) && toBoolean(b));
/**
 * Performs logical OR operation.
 * @param a First operand
 * @param b Second operand
 * @returns 1 if either non-zero, 0 otherwise
 */
export const or = (a: number, b: number): number => toNumber(toBoolean(a) || toBoolean(b));
/**
 * Performs logical XOR operation.
 * @param a First operand
 * @param b Second operand
 * @returns 1 if exactly one non-zero, 0 otherwise
 */
export const xor = (a: number, b: number): number => toNumber(toBoolean(a) !== toBoolean(b));

/**
 * Formats are provided by core/format-utils.
 */

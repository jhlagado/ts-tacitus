/**
 * @file src/core/utils.ts
 * Utility functions for the Tacit VM implementation.
 */

import { getTaggedInfo, Tag, Sentinel } from './tagged';

/**
 * Compares two tagged values for equality.
 * Handles both regular numbers and NaN-boxed tagged values.
 * @param a - First value to compare
 * @param b - Second value to compare
 * @returns True if values are equal
 */
export function areValuesEqual(a: number, b: number): boolean {
  if (!isNaN(a) && !isNaN(b)) {
    return a === b;
  }

  const aDecoded = getTaggedInfo(a);
  const bDecoded = getTaggedInfo(b);
  if (aDecoded.tag === Tag.SENTINEL && aDecoded.value === Sentinel.DEFAULT) {
    return true;
  }
  if (bDecoded.tag === Tag.SENTINEL && bDecoded.value === Sentinel.DEFAULT) {
    return true;
  }
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
 * Formats are provided by core/format-utils.
 */

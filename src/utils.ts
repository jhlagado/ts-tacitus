/**
 * Utility functions for character checks.
 */

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

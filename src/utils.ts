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
export const isGroupingChar = (char: string): boolean =>
  "{}[]()\"'`".includes(char);


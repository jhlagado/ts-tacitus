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
 * Checks if a character is a letter.
 */
export function isLetter(char: string): boolean {
  return (char >= "a" && char <= "z") || (char >= "A" && char <= "Z");
}

/**
 * Checks if a character is whitespace.
 */
export function isWhitespace(char: string): boolean {
  return char <= " "; // Covers space, tab, newline, carriage return
}

/**
 * Checks if a character is a symbol using ASCII ranges.
 */
export function isSymbol(char: string): boolean {
  const charCode = char.charCodeAt(0);
  return (
    (charCode >= 0x21 && charCode <= 0x2f) || // ! " # $ % & ' ( ) * + , - . /
    (charCode >= 0x3a && charCode <= 0x40) || // : ; < = > ? @
    (charCode >= 0x5b && charCode <= 0x60) || // [ \ ] ^ _ `
    (charCode >= 0x7b && charCode <= 0x7e) // { | } ~  );
  );
}

/**
 * Checks if a character is of a grouping structure
 */
export const isGroupingChar = (char: string): boolean =>
  "{}[]()\"'`".includes(char);

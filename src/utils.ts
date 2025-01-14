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

  // Check ranges for common symbols
  return (
    (charCode >= 33 && charCode <= 47) || // ! " # $ % & ' ( ) * + , - . /
    (charCode >= 58 && charCode <= 64) || // : ; < = > ? @
    (charCode >= 91 && charCode <= 96) || // [ \ ] ^ _ `
    (charCode >= 123 && charCode <= 126) // { | } ~
  );
}

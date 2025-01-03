/**
 * Lexer for the Forth interpreter.
 * Splits input into tokens, skips comments, and parses numbers.
 */

/**
 * Tokenizes the input string.
 * @param input - The input string to tokenize.
 * @returns An array of tokens (words or numbers).
 */
export function tokenize(input: string): (string | number)[] {
  const tokens: (string | number)[] = [];
  const lines = input.split("\n"); // Split input into lines to handle comments

  for (const line of lines) {
    const trimmedLine = line.trim();

    // Skip empty lines and comments (lines starting with #)
    if (trimmedLine === "" || trimmedLine.startsWith("#")) {
      continue;
    }

    // Split the line into words based on whitespace
    const words = trimmedLine.split(/\s+/);

    for (const word of words) {
      if (word === "") {
        continue; // Skip empty words (e.g., multiple spaces)
      }

      // Check if the word is a number
      if (/^-?\d+(\.\d+)?$/.test(word)) {
        // Parse as a number (integer or float)
        tokens.push(parseFloat(word));
      } else {
        // Treat as a regular word
        tokens.push(word);
      }
    }
  }

  return tokens;
}
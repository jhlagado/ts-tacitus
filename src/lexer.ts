import { isDigit, isLetter, isWhitespace, isSymbol } from "./utils";

/**
 * Lexer for the interpreter.
 * Splits input into tokens, skips comments, and parses numbers.
 */

/**
 * Tokenizes the input string.
 * @param input - The input string to tokenize.
 * @returns An array of tokens (words or numbers).
 */
export function lex(input: string): (string | number)[] {
  const tokens: (string | number)[] = [];
  const lines = input.split("\n"); // Split input into lines to handle comments

  for (const line of lines) {
    const trimmedLine = line.trim();

    // Skip empty lines and comments (lines starting with #)
    if (trimmedLine === "" || trimmedLine.startsWith("#")) {
      continue;
    }

    // Remove any inline comments (everything after # on the same line)
    const code = trimmedLine.split("#")[0].trim();

    // Skip if the line is empty after removing comments
    if (code === "") {
      continue;
    }

    // Tokenize the line
    let current = 0;
    while (current < code.length) {
      const char = code[current];

      // Skip whitespace
      if (isWhitespace(char)) {
        current++;
        continue;
      }

      // Handle numbers (including negative numbers)
      if (isDigit(char) || char === "-" || char === "+" || char === ".") {
        let numStr = "";
        let hasDecimal = false;

        // Handle negative numbers or positive numbers with explicit sign
        if (char === "-" || char === "+") {
          numStr += char;
          current++;
          if (current >= code.length || !isDigit(code[current])) {
            // Treat standalone + or - as operators
            tokens.push(char);
            continue;
          }
        }

        // Collect digits and decimal points
        while (current < code.length) {
          const currentChar = code[current];
          if (isDigit(currentChar)) {
            numStr += currentChar;
            current++;
          } else if (currentChar === ".") {
            if (hasDecimal) {
              // More than one decimal point is invalid
              throw new Error(`Invalid number: ${numStr}.`);
            }
            numStr += currentChar;
            hasDecimal = true;
            current++;
          } else {
            break;
          }
        }

        const num = parseFloat(numStr);
        if (!isNaN(num)) {
          tokens.push(num);
        } else {
          throw new Error(`Invalid number: ${numStr}`);
        }
        continue;
      }

      // Handle words (e.g., swap, drop, foo@bar)
      if (isLetter(char) || char === "_") {
        let word = "";
        while (
          current < code.length &&
          (isLetter(code[current]) ||
            isDigit(code[current]) ||
            code[current] === "_")
        ) {
          word += code[current];
          current++;
        }
        tokens.push(word);
        continue;
      }

      // Handle standalone symbols (e.g., +, -, *, /, @, #, etc.)
      if (isSymbol(char)) {
        tokens.push(char);
        current++;
        continue;
      }

      // Handle unknown characters
      throw new Error(`Unknown character: ${char}`);
    }
  }

  return tokens;
}

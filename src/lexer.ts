import { isDigit, isWhitespace, isGroupingChar } from "./utils";

/**
 * Tokenizes the input string.
 * @param input - The input string to tokenize.
 * @returns An array of tokens (words, numbers, or grouping characters).
 */
export function lex(input: string): (string | number)[] {
  const tokens: (string | number)[] = [];
  const lines = input.split("\n"); // Split input into lines to handle comments

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (trimmedLine === "" || trimmedLine.startsWith("#")) {
      continue;
    }

    const code = trimmedLine.split("#")[0].trim();

    if (code === "") {
      continue;
    }

    let current = 0;
    while (current < code.length) {
      const char = code[current];

      if (isWhitespace(char)) {
        current++;
        continue;
      }

      if (isDigit(char) || char === "-" || char === "+" || char === ".") {
        let numStr = "";
        let hasDecimal = false;

        if (char === "-" || char === "+") {
          numStr += char;
          current++;
          if (current >= code.length || !isDigit(code[current])) {
            tokens.push(char);
            continue;
          }
        }

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

      if (isGroupingChar(char)) {
        tokens.push(char);
        current++;
        continue;
      }

      let name = "";
      while (
        current < code.length &&
        !isWhitespace(code[current]) &&
        !isGroupingChar(code[current])
      ) {
        name += code[current];
        current++;
      }
      tokens.push(name);
    }
  }

  return tokens;
}

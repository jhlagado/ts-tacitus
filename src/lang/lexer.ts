import { isDigit, isWhitespace, isGroupingChar } from "../core/utils";

export function lex(input: string): (string | number)[] {
  const tokens: (string | number)[] = [];
  let i = 0;

  while (i < input.length) {
    const char = input[i];

    if (isWhitespace(char)) {
      i++;
      continue;
    }

    // Handle // comments (NEW: Keep this logic to strip comments)
    if (char === "/" && i + 1 < input.length && input[i + 1] === "/") {
      // Skip to end of line
      while (i < input.length && input[i] !== "\n") i++;
      continue;
    }

    // Number handling
    if (isDigit(char) || char === "+" || char === "-" || char === ".") {
      let tokenStr = char;
      i++;

      while (
        i < input.length &&
        !isWhitespace(input[i]) &&
        !isGroupingChar(input[i])
      ) {
        tokenStr += input[i];
        i++;
      }

      const num = Number(tokenStr);
      if (!isNaN(num)) {
        tokens.push(num);
      } else {
        tokens.push(tokenStr);
      }
      continue;
    }

    // Grouping characters
    if (isGroupingChar(char)) {
      tokens.push(char);
      i++;
      continue;
    }

    // Identifiers
    let word = "";
    while (
      i < input.length &&
      !isWhitespace(input[i]) &&
      !isGroupingChar(input[i])
    ) {
      word += input[i];
      i++;
    }
    if (word) tokens.push(word);
  }

  return tokens;
}

import { tokenize } from "./lexer";

describe("Lexer", () => {
  it("should tokenize a simple command", () => {
    const tokens = tokenize("5 3 +");
    expect(tokens).toEqual([5, 3, "+"]);
  });

  it("should handle comments", () => {
    const tokens = tokenize("# This is a comment\n5 3 +");
    expect(tokens).toEqual([5, 3, "+"]);
  });

  it("should parse numbers", () => {
    const tokens = tokenize("5 -3.14 42");
    expect(tokens).toEqual([5, -3.14, 42]);
  });

  it("should handle mixed input", () => {
    const tokens = tokenize("5 dup # Comment\n3.14 swap");
    expect(tokens).toEqual([5, "dup", 3.14, "swap"]);
  });

  it("should skip empty lines and spaces", () => {
    const tokens = tokenize("  \n5   \n3  +  ");
    expect(tokens).toEqual([5, 3, "+"]);
  });
});

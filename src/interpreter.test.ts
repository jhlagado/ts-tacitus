import { execute, initializeInterpreter } from "./interpreter";

describe("Interpreter", () => {
  beforeEach(() => {
    initializeInterpreter(); // Reset the interpreter state before each test
  });

  it("should execute a simple command", () => {
    const result = execute("5 3 +");
    expect(result).toEqual([8]);
  });

  it("should handle empty commands", () => {
    const result = execute("");
    expect(result).toEqual([]);
  });

  it("should throw an error for unknown words", () => {
    expect(() => execute("unknown")).toThrow("Unknown word: unknown");
  });

  it("should handle stack underflow gracefully", () => {
    expect(() => execute("+")).toThrow(
      "Error executing word '+' (stack: []): Stack underflow"
    );
  });

  it("should handle division by zero", () => {
    expect(() => execute("5 0 /")).toThrow(
      "Error executing word '/' (stack: []): Division by zero"
    );
  });

  it("should push numbers onto the stack", () => {
    const result = execute("5 3");
    expect(result).toEqual([5, 3]);
  });

  it("should execute multiple operations", () => {
    const result = execute("5 3 + 2 *");
    expect(result).toEqual([16]);
  });
});

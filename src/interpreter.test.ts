import { execute } from "./interpreter";

describe("Interpreter", () => {
  it("should execute a simple command", () => {
    const result = execute("hello");
    expect(result).toBe("Executed: hello");
  });

  it("should handle empty commands", () => {
    const result = execute("");
    expect(result).toBe("Executed: ");
  });
});

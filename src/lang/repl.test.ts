import { createInterface } from "readline";
import { startREPL } from "./repl";
import * as parser from "./parser"; // Import the parser module
import * as interpreter from "./interpreter"; // Import the interpreter module
import * as lexer from "./lexer"; // Import the lexer module

jest.mock("readline");

describe("REPL", () => {
  let mockCreateInterface: jest.Mock;
  let mockOn: jest.Mock;
  let mockPrompt: jest.Mock;
  let mockClose: jest.Mock;

  beforeEach(() => {
    mockCreateInterface = createInterface as jest.Mock;
    mockOn = jest.fn();
    mockPrompt = jest.fn();
    mockClose = jest.fn();

    mockCreateInterface.mockReturnValue({
      on: mockOn,
      prompt: mockPrompt,
      close: mockClose,
    });

    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  it("should handle the 'exit' command", () => {
    mockOn.mockImplementation((event, callback) => {
      if (event === "line") {
        callback("exit"); // Simulate 'exit' command
      }
    });

    const consoleLogSpy = jest
      .spyOn(console, "log")
      .mockImplementation(() => {});

    startREPL();

    // Verify goodbye message is logged
    expect(consoleLogSpy).toHaveBeenCalledWith("Goodbye!");

    // Verify close is called
    expect(mockClose).toHaveBeenCalled();

    // Ensure prompt is not called after exit
    expect(mockPrompt.mock.calls.length).toBe(1); // Initial prompt only
    consoleLogSpy.mockRestore();
  });

  it("should handle the 'close' event", () => {
    mockOn.mockImplementation((event, callback) => {
      if (event === "close") {
        callback();
      }
    });

    const consoleLogSpy = jest
      .spyOn(console, "log")
      .mockImplementation(() => {});

    startREPL();

    expect(consoleLogSpy).toHaveBeenCalledWith("REPL exited.");
    consoleLogSpy.mockRestore();
  });

  it("should handle a standard command", () => {
    mockOn.mockImplementation((event, callback) => {
      if (event === "line") {
        callback("5 3 +"); // Simulate a standard command
      }
    });

    const consoleLogSpy = jest
      .spyOn(console, "log")
      .mockImplementation(() => {});
    const executeSpy = jest
      .spyOn(interpreter, "execute")
      .mockImplementation(() => {
        console.log([8]); // Simulate the output of the execute function
      });

    startREPL();

    // Verify 'execute' is called
    expect(executeSpy).toHaveBeenCalled();

    // Verify the result of 'execute' is logged
    expect(consoleLogSpy).toHaveBeenCalledWith([8]);

    // Verify 'prompt' is called again after processing the command
    expect(mockPrompt).toHaveBeenCalledTimes(2); // Initial + after execution

    consoleLogSpy.mockRestore();
    executeSpy.mockRestore();
  });

  it("should handle an unknown word", () => {
    mockOn.mockImplementation((event, callback) => {
      if (event === "line") {
        callback("unknown"); // Simulate an unknown word
      }
    });

    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const parseSpy = jest.spyOn(parser, "parse").mockImplementation(() => {
      throw new Error("Unknown word: unknown");
    });

    startREPL();

    // Verify 'parse' is called
    expect(parseSpy).toHaveBeenCalled();

    // Verify the error message is logged
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Error: Unknown word: unknown"
    );

    // Verify 'prompt' is called again after processing the command
    expect(mockPrompt).toHaveBeenCalledTimes(2); // Initial + after execution

    consoleErrorSpy.mockRestore();
    parseSpy.mockRestore();
  });

  it("should handle a stack underflow error", () => {
    mockOn.mockImplementation((event, callback) => {
      if (event === "line") {
        callback("+"); // Simulate a stack underflow
      }
    });

    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const executeSpy = jest
      .spyOn(interpreter, "execute")
      .mockImplementation(() => {
        throw new Error(
          "Error executing word '+' (stack: []): Stack underflow"
        );
      });

    startREPL();

    // Verify 'execute' is called
    expect(executeSpy).toHaveBeenCalled();

    // Verify the error message is logged
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Error: Error executing word '+' (stack: []): Stack underflow"
    );

    // Verify 'prompt' is called again after processing the command
    expect(mockPrompt).toHaveBeenCalledTimes(2); // Initial + after execution

    consoleErrorSpy.mockRestore();
    executeSpy.mockRestore();
  });

  it("should handle errors during lexing", () => {
    mockOn.mockImplementation((event, callback) => {
      if (event === "line") {
        callback("invalid command"); // Simulate an invalid command
      }
    });

    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const lexSpy = jest.spyOn(lexer, "lex").mockImplementation(() => {
      throw new Error("Lexing error");
    });

    startREPL();

    // Verify 'lex' is called
    expect(lexSpy).toHaveBeenCalledWith("invalid command");

    // Verify the error message is logged
    expect(consoleErrorSpy).toHaveBeenCalledWith("Error: Lexing error");

    // Verify 'prompt' is called again after handling the error
    expect(mockPrompt).toHaveBeenCalledTimes(2); // Initial + after error

    consoleErrorSpy.mockRestore();
    lexSpy.mockRestore();
  });

  it("should handle unknown errors", () => {
    mockOn.mockImplementation((event, callback) => {
      if (event === "line") {
        callback("invalid command"); // Simulate an invalid command
      }
    });

    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const lexSpy = jest.spyOn(lexer, "lex").mockImplementation(() => {
      throw "Unknown error"; // Simulate a non-Error object
    });

    startREPL();

    // Verify 'lex' is called
    expect(lexSpy).toHaveBeenCalledWith("invalid command");

    // Verify the unknown error message is logged
    expect(consoleErrorSpy).toHaveBeenCalledWith("Unknown error occurred");

    // Verify 'prompt' is called again after handling the error
    expect(mockPrompt).toHaveBeenCalledTimes(2); // Initial + after error

    consoleErrorSpy.mockRestore();
    lexSpy.mockRestore();
  });
});

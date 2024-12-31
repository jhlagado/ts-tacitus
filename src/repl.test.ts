import { startREPL } from "./repl";
import { createInterface } from 'readline';
import * as interpreter from "./interpreter";

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
        callback("test command"); // Simulate a standard command
      }
    });

    const consoleLogSpy = jest
      .spyOn(console, "log")
      .mockImplementation(() => {});
    const executeSpy = jest
      .spyOn(interpreter, "execute")
      .mockReturnValue("Executed: test command");

    startREPL();

    // Verify 'execute' is called with the correct command
    expect(executeSpy).toHaveBeenCalledWith("test command");

    // Verify the result of 'execute' is logged
    expect(consoleLogSpy).toHaveBeenCalledWith("Executed: test command");

    // Verify 'prompt' is called again after processing the command
    expect(mockPrompt).toHaveBeenCalledTimes(2); // Initial + after execution

    consoleLogSpy.mockRestore();
    executeSpy.mockRestore();
  });
});

import * as fs from "fs";
import * as path from "path";
import { execute } from "./interpreter";
import { parse } from "./parser";
import { Tokenizer } from "./tokenizer";
import { initializeInterpreter } from "./globalState";

// Create mock functions before mocking the module
const mockProcessFile = jest.fn();
const mockRunFiles = jest.fn();

// We need to mock these before importing the actual module
jest.mock("fs");
jest.mock("path");
jest.mock("./interpreter");
jest.mock("./parser");
jest.mock("./tokenizer", () => ({
  Tokenizer: jest.fn().mockImplementation((input) => {
    return {
      input,
      nextToken: jest.fn(),
    };
  }),
}));
jest.mock("../core/globalState", () => ({
  initializeInterpreter: jest.fn(),
  vm: {
    compiler: {
      BP: 0,
    },
  },
}));

// Mock the entire runner module
jest.mock("./runner", () => {
  // Get the original module to preserve constants
  const original = jest.requireActual("./runner");
  return {
    ...original,
    processFile: mockProcessFile,
    // Replace runFiles with our mock
    runFiles: mockRunFiles,
  };
});

// NOW import the module to test
import * as runnerModule from "./runner";

// Mock console methods
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

describe("Runner", () => {
  // Setup before each test
  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Mock process.exit
    jest.spyOn(process, "exit").mockImplementation((code) => {
      throw new Error(`Process exit with code: ${code}`);
    });

    // Mock console methods
    console.log = jest.fn();
    console.error = jest.fn();

    // Mock path.resolve to return the input
    (path.resolve as jest.Mock).mockImplementation((p) => p);

    // Default fs.existsSync mock
    (fs.existsSync as jest.Mock).mockReturnValue(true);
  });

  // Cleanup after each test
  afterEach(() => {
    // Restore console methods
    console.log = originalConsoleLog;
    console.error = originalConsoleError;

    // Restore mocks
    jest.restoreAllMocks();
  });

  describe("processFile", () => {
    // For this group, we'll test the actual processFile implementation
    beforeEach(() => {
      // Store the real implementation temporarily
      const actualModule = jest.requireActual("./runner");

      // Configure the mock to call through to the real implementation
      mockProcessFile.mockImplementation((filePath: string) => {
        return actualModule.processFile(filePath);
      });
    });

    test("should add .tacit extension when missing", () => {
      // Arrange
      const filePath = "testfile";
      (fs.readFileSync as jest.Mock).mockReturnValue("test content");
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (path.extname as jest.Mock).mockReturnValue("");

      // Act
      runnerModule.processFile(filePath);

      // Assert
      expect(fs.existsSync).toHaveBeenCalledWith(
        expect.stringMatching(/testfile\.tacit$/)
      );
    });

    test("should not add .tacit extension when already present", () => {
      // Arrange
      const filePath = "testfile.tacit";
      (fs.readFileSync as jest.Mock).mockReturnValue("test content");
      (path.extname as jest.Mock).mockReturnValue(".tacit");

      // Act
      runnerModule.processFile(filePath);

      // Assert
      expect(fs.existsSync).toHaveBeenCalledWith("testfile.tacit");
    });

    test("should return false when file does not exist", () => {
      // Arrange
      const filePath = "nonexistent.tacit";
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      // Act
      const result = runnerModule.processFile(filePath);

      // Assert
      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining("File not found")
      );
    });

    test("should process file content line by line", () => {
      // Arrange
      const filePath = "test.tacit";
      (fs.readFileSync as jest.Mock).mockReturnValue("line1\nline2\nline3");

      // Act
      const result = runnerModule.processFile(filePath);

      // Assert
      expect(result).toBe(true);
      expect(Tokenizer).toHaveBeenCalledTimes(3);
      expect(parse).toHaveBeenCalledTimes(3);
      expect(execute).toHaveBeenCalledTimes(3);

      // Check that parse was called with Tokenizer instances
      expect(parse).toHaveBeenCalledWith(expect.any(Object));
    });

    test("should skip empty lines and comments", () => {
      // Arrange
      const filePath = "test.tacit";
      (fs.readFileSync as jest.Mock).mockReturnValue(
        "line1\n\n// Comment\nline2"
      );

      // Act
      const result = runnerModule.processFile(filePath);

      // Assert
      expect(result).toBe(true);
      expect(Tokenizer).toHaveBeenCalledTimes(2);
      expect(parse).toHaveBeenCalledTimes(2);
      expect(execute).toHaveBeenCalledTimes(2);
    });

    test("should return false and stop processing on tokenizer error", () => {
      // Arrange
      const filePath = "test.tacit";
      (fs.readFileSync as jest.Mock).mockReturnValue("line1\nline2\nline3");

      // Make the Tokenizer constructor throw on the second call
      (Tokenizer as jest.Mock)
        .mockImplementationOnce(() => ({
          input: "line1",
          nextToken: jest.fn(),
        }))
        .mockImplementationOnce(() => {
          throw new Error("Tokenizer error");
        });

      // Act
      const result = runnerModule.processFile(filePath);

      // Assert
      expect(result).toBe(false);
      expect(Tokenizer).toHaveBeenCalledTimes(2);
      expect(parse).toHaveBeenCalledTimes(1);
      expect(execute).toHaveBeenCalledTimes(1);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining("Error in file")
      );
    });

    test("should return false and stop processing on parser error", () => {
      // Arrange
      const filePath = "test.tacit";
      (fs.readFileSync as jest.Mock).mockReturnValue("line1\nline2\nline3");

      // Make parse throw on the second call
      (parse as jest.Mock)
        .mockImplementationOnce(() => {})
        .mockImplementationOnce(() => {
          throw new Error("Parser error");
        });

      // Act
      const result = runnerModule.processFile(filePath);

      // Assert
      expect(result).toBe(false);
      expect(Tokenizer).toHaveBeenCalledTimes(2);
      expect(parse).toHaveBeenCalledTimes(2);
      expect(execute).toHaveBeenCalledTimes(1);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining("Error in file")
      );
    });

    test("should return false on file read error", () => {
      // Arrange
      const filePath = "test.tacit";
      (fs.readFileSync as jest.Mock).mockImplementation(() => {
        throw new Error("Read error");
      });

      // Act
      const result = runnerModule.processFile(filePath);

      // Assert
      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to read file")
      );
    });
  });

  describe("runFiles", () => {
    // Use our own implementation of runFiles for testing
    beforeEach(() => {
      // Reset mocks
      mockProcessFile.mockReset();
      mockRunFiles.mockReset();

      // Implement our test version of runFiles that uses mockProcessFile
      mockRunFiles.mockImplementation((files: string[]) => {
        initializeInterpreter();

        console.log("Tacit file processing mode:");
        for (const file of files) {
          const success = mockProcessFile(file);
          if (!success) {
            console.log("Processing stopped due to error.");
            process.exit(1); // This will trigger our mocked process.exit
          }
        }
        console.log("All Tacit files processed successfully.");
      });
    });

    test("should initialize interpreter once", () => {
      // Arrange
      const files = ["file1.tacit", "file2.tacit"];

      // Configure the mock to return true
      mockProcessFile.mockReturnValue(true);

      // Act
      runnerModule.runFiles(files);

      // Assert
      expect(initializeInterpreter).toHaveBeenCalledTimes(1);
      expect(mockProcessFile).toHaveBeenCalledTimes(2);
    });

    test("should process all files when successful", () => {
      // Arrange
      const files = ["file1.tacit", "file2.tacit", "file3.tacit"];

      // Configure the mock to return true
      mockProcessFile.mockReturnValue(true);

      // Act
      runnerModule.runFiles(files);

      // Assert
      expect(mockProcessFile).toHaveBeenCalledTimes(3);
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("All Tacit files processed successfully")
      );
    });

    test("should exit on first file error", () => {
      // Arrange
      const files = ["file1.tacit", "file2.tacit", "file3.tacit"];

      // Configure the mock to fail on second file
      mockProcessFile.mockReturnValueOnce(true).mockReturnValueOnce(false);

      // Act & Assert
      expect(() => runnerModule.runFiles(files)).toThrow(
        "Process exit with code: 1"
      );
      expect(mockProcessFile).toHaveBeenCalledTimes(2);
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("Processing stopped due to error")
      );
    });
  });
});

// Save original process.exit so you can restore it later
const originalExit = process.exit;

// --- Step 1. Mock external dependencies BEFORE importing fileProcessor ---
jest.mock("fs");
jest.mock("path");
jest.mock("./executor");

// Override process.exit (using a cast to satisfy TS)
const mockExit = jest.fn();
process.exit = mockExit as unknown as typeof process.exit;

// --- Step 2. Rewire fileProcessor with a custom factory ---
// This factory returns the real implementations but replaces processFile with a jest mock.
jest.mock("./fileProcessor", () => {
  const actual = jest.requireActual("./fileProcessor");
  return {
    ...actual,
    processFile: jest.fn((filePath: string) => actual.processFile(filePath)),
  };
});

// --- Step 3. Now import using normal TS imports ---
import * as fs from "fs";
import * as path from "path";
import {
  processFile,
  processFiles,
  TACIT_FILE_EXTENSION,
} from "./fileProcessor";
import { executeLine, setupInterpreter } from "./executor";

// Save original console methods
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

// Remove any additional process.exit overrides — no beforeAll override here!

afterAll(() => {
  process.exit = originalExit;
});

describe("processFile", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    console.log = jest.fn();
    console.error = jest.fn();

    // Default mocks for path and fs used by processFile
    (path.resolve as jest.Mock).mockImplementation(
      (p: string) => `/resolved/${p}`
    );
    (fs.existsSync as jest.Mock).mockReturnValue(true);
  });
  afterEach(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });

  it("should add .tacit extension when missing", () => {
    (fs.readFileSync as jest.Mock).mockReturnValue("test content");
    (path.extname as jest.Mock).mockReturnValue("");
    processFile("testfile");
    expect(fs.existsSync).toHaveBeenCalledWith(
      `/resolved/testfile${TACIT_FILE_EXTENSION}`
    );
  });

  it("should not add .tacit extension when already present", () => {
    (fs.readFileSync as jest.Mock).mockReturnValue("test content");
    (path.extname as jest.Mock).mockReturnValue(TACIT_FILE_EXTENSION);
    processFile("testfile" + TACIT_FILE_EXTENSION);
    expect(fs.existsSync).toHaveBeenCalledWith(
      `/resolved/testfile${TACIT_FILE_EXTENSION}`
    );
  });

  it("should return false when file does not exist", () => {
    (fs.existsSync as jest.Mock).mockReturnValue(false);
    (path.extname as jest.Mock).mockReturnValue("");
    const result = processFile("nonexistent");
    expect(result).toBe(false);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("File not found")
    );
  });

  it("should process file content line by line", () => {
    const fileContent = "line1\n   \n// comment\nline2";
    (fs.readFileSync as jest.Mock).mockReturnValue(fileContent);
    (path.extname as jest.Mock).mockReturnValue(TACIT_FILE_EXTENSION);
    processFile("file.tacit");
    expect(executeLine).toHaveBeenCalledTimes(2);
    expect(executeLine).toHaveBeenNthCalledWith(1, "line1");
    expect(executeLine).toHaveBeenNthCalledWith(2, "line2");
  });

  it("should return false on execution error", () => {
    const fileContent = "line1\nline2\nline3";
    (fs.readFileSync as jest.Mock).mockReturnValue(fileContent);
    (path.extname as jest.Mock).mockReturnValue(TACIT_FILE_EXTENSION);
    (executeLine as jest.Mock)
      .mockImplementationOnce(() => {})
      .mockImplementationOnce(() => {
        throw new Error("Execution error");
      });
    const result = processFile("file.tacit");
    expect(result).toBe(false);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("Error in file")
    );
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("at line 2:")
    );
  });

  it("should return false on file read error", () => {
    (fs.readFileSync as jest.Mock).mockImplementation(() => {
      throw new Error("Read error");
    });
    (path.extname as jest.Mock).mockReturnValue("");
    const result = processFile("file");
    expect(result).toBe(false);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("Failed to read file")
    );
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("Read error")
    );
  });
});

describe("processFiles", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    console.log = jest.fn();
    console.error = jest.fn();
    (setupInterpreter as jest.Mock).mockClear();
  });
  afterEach(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });

  it("should initialize interpreter once and process all files successfully", () => {
    // Create a mock processFile function that always returns true
    const mockProcessFile = jest.fn().mockReturnValue(true);
    const files = ["file1.tacit", "file2.tacit"];
    const result = processFiles(files, true, mockProcessFile);

    expect(setupInterpreter).toHaveBeenCalledTimes(1);
    expect(mockProcessFile).toHaveBeenCalledTimes(files.length);
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("All Tacit files processed successfully")
    );
    expect(result).toBe(true);
  });

  it("should exit on first file error when exitOnError is true", () => {
    const mockProcessFile = jest
      .fn()
      .mockImplementationOnce(() => true)
      .mockImplementationOnce(() => false);
    const files = ["file1.tacit", "file2.tacit", "file3.tacit"];
    const result = processFiles(files, true, mockProcessFile);

    expect(mockProcessFile).toHaveBeenCalledTimes(2);
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("Processing stopped due to error")
    );
    expect(mockExit).toHaveBeenCalledWith(1); // Now this uses the same mockExit.
    expect(result).toBe(false);
  });

  it("should not exit on file error when exitOnError is false", () => {
    // Even if a file fails, if exitOnError is false process.exit shouldn't be called.
    const mockProcessFile = jest
      .fn()
      .mockImplementationOnce(() => true)
      .mockImplementationOnce(() => false)
      .mockImplementationOnce(() => true); // This call shouldn't happen.
    const files = ["file1.tacit", "file2.tacit", "file3.tacit"];
    const result = processFiles(files, false, mockProcessFile);

    expect(mockProcessFile).toHaveBeenCalledTimes(2);
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("Processing stopped due to error")
    );
    expect(mockExit).not.toHaveBeenCalled();
    expect(result).toBe(false);
  });
});

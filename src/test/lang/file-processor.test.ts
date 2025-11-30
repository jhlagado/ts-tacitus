const originalExit = process.exit;

jest.mock('fs');
jest.mock('path');
jest.mock('../../lang/parser');
jest.mock('../../lang/interpreter');

const mockExit = jest.fn();

process.exit = mockExit as unknown as typeof process.exit;

import * as fs from 'fs';
import * as path from 'path';
import { processFile, processFiles, TACIT_FILE_EXTENSION } from '../../lang/file-processor';
import { createVM } from '../../core';
import { parse } from '../../lang/parser';
import { execute } from '../../lang/interpreter';

const originalConsoleLog = console.log;

const originalConsoleError = console.error;

afterAll(() => {
  process.exit = originalExit;
});
describe('processFile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    console.log = jest.fn();
    console.error = jest.fn();
    (path.resolve as jest.Mock).mockImplementation((p: string) => `/resolved/${p}`);
    (fs.existsSync as jest.Mock).mockReturnValue(true);
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });

  test('should add .tacit extension when missing', () => {
    (fs.readFileSync as jest.Mock).mockReturnValue('test content');
    (path.extname as jest.Mock).mockReturnValue('');
    (parse as jest.Mock).mockImplementation(() => {});
    (execute as jest.Mock).mockImplementation(() => {});
    const vm = createVM();
    processFile(vm, 'testfile');
    expect(fs.existsSync).toHaveBeenCalledWith(`/resolved/testfile${TACIT_FILE_EXTENSION}`);
  });

  test('should not add .tacit extension when already present', () => {
    (fs.readFileSync as jest.Mock).mockReturnValue('test content');
    (path.extname as jest.Mock).mockReturnValue(TACIT_FILE_EXTENSION);
    (parse as jest.Mock).mockImplementation(() => {});
    (execute as jest.Mock).mockImplementation(() => {});
    const vm = createVM();
    processFile(vm, 'testfile' + TACIT_FILE_EXTENSION);
    expect(fs.existsSync).toHaveBeenCalledWith(`/resolved/testfile${TACIT_FILE_EXTENSION}`);
  });

  test('should return false when file does not exist', () => {
    (fs.existsSync as jest.Mock).mockReturnValue(false);
    (path.extname as jest.Mock).mockReturnValue('');
    const vm = createVM();
    const result = processFile(vm, 'nonexistent');
    expect(result).toBe(false);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('File not found'));
  });

  test('should process file content line by line', () => {
    const fileContent = 'line1\n   \nline2';
    (fs.readFileSync as jest.Mock).mockReturnValue(fileContent);
    (path.extname as jest.Mock).mockReturnValue(TACIT_FILE_EXTENSION);
    (parse as jest.Mock).mockImplementation(() => {});
    (execute as jest.Mock).mockImplementation(() => {});
    const vm = createVM();
    processFile(vm, 'file.tacit');
    expect(parse).toHaveBeenCalledTimes(1);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  test('should return false on file read error', () => {
    (fs.readFileSync as jest.Mock).mockImplementation(() => {
      throw new Error('Read error');
    });
    (path.extname as jest.Mock).mockReturnValue('');
    const vm = createVM();
    const result = processFile(vm, 'file');
    expect(result).toBe(false);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Failed to read file'));
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Read error'));
  });
});

describe('processFiles', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    console.log = jest.fn();
    console.error = jest.fn();
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });

  test('should initialize interpreter once and process all files successfully', () => {
    const mockProcessFile = jest.fn().mockReturnValue(true);
    const files = ['file1.tacit', 'file2.tacit'];
    const result = processFiles(files, true, mockProcessFile);
    expect(mockProcessFile).toHaveBeenCalledTimes(files.length);
    expect(mockProcessFile).toHaveBeenNthCalledWith(1, expect.any(Object), 'file1.tacit');
    expect(mockProcessFile).toHaveBeenNthCalledWith(2, expect.any(Object), 'file2.tacit');
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('All Tacit files processed successfully'),
    );
    expect(result).toBe(true);
  });

  test('should exit on first file error when exitOnError is true', () => {
    const mockProcessFile = jest
      .fn()
      .mockImplementationOnce((_vm, _file) => true)
      .mockImplementationOnce((_vm, _file) => false);
    const files = ['file1.tacit', 'file2.tacit', 'file3.tacit'];
    const result = processFiles(files, true, mockProcessFile);
    expect(mockProcessFile).toHaveBeenCalledTimes(2);
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('Processing stopped due to error'),
    );
    expect(mockExit).toHaveBeenCalledWith(1);
    expect(result).toBe(false);
  });

  test('should not exit on file error when exitOnError is false', () => {
    const mockProcessFile = jest
      .fn()
      .mockImplementationOnce((_vm, _file) => true)
      .mockImplementationOnce((_vm, _file) => false)
      .mockImplementationOnce((_vm, _file) => true);
    const files = ['file1.tacit', 'file2.tacit', 'file3.tacit'];
    const result = processFiles(files, false, mockProcessFile);
    expect(mockProcessFile).toHaveBeenCalledTimes(2);
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('Processing stopped due to error'),
    );
    expect(mockExit).not.toHaveBeenCalled();
    expect(result).toBe(false);
  });
});

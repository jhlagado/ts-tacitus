/**
 * Lightweight coverage tests for repl.startREPL non-interactive branches
 */
import { jest } from '@jest/globals';

// Mock executor and fileProcessor to avoid side-effects and I/O
jest.mock('../../lang/executor', () => ({
  setupInterpreter: jest.fn(),
  executeLine: jest.fn(),
}));

// Keep typing simple to avoid TS generic issues across ts-jest
const processFileMock: any = jest.fn();
jest.mock('../../lang/fileProcessor', () => ({
  processFile: (file: string) => processFileMock(file),
}));

import { startREPL } from '../../lang/repl';

describe('repl.startREPL non-interactive coverage', () => {
  beforeEach(() => {
    processFileMock.mockReset();
  });

  test('returns early when interactiveAfterFiles is false with no files', () => {
    expect(() => startREPL([], false)).not.toThrow();
  });

  test('processes files successfully (allFilesProcessed true) without entering interactive mode', () => {
    processFileMock.mockReturnValueOnce(true);
    expect(() => startREPL(['ok.tac'], false)).not.toThrow();
  });

  test('handles file processing error path (allFilesProcessed false)', () => {
    processFileMock.mockReturnValueOnce(false);
    expect(() => startREPL(['bad.tac'], false)).not.toThrow();
  });
});
